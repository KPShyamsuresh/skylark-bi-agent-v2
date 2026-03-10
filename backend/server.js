// server.js - Skylark BI Agent Backend

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { fetchBoards, fetchAllBoardItems, normalizeItem, detectBoardType } = require('./mondayClient');
const { cleanWorkOrderItem, cleanDealItem, analyzeWorkOrders, analyzeDeals, crossBoardAnalysis } = require('./dataEngine');
const { processQuery, generateLeadershipUpdate } = require('./aiAgent');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization', 'x-monday-token'] }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/', rateLimit({ windowMs: 60000, max: 40 }));

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(token) {
  const e = cache.get(token);
  return e && Date.now() - e.timestamp < CACHE_TTL ? e.data : null;
}

function setCached(token, data) {
  if (cache.size > 50) cache.delete(cache.keys().next().value);
  cache.set(token, { data, timestamp: Date.now() });
}

// ─── Load & Process Monday Data ───────────────────────────────────────────────
async function loadMondayData(mondayToken, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCached(mondayToken);
    if (cached) return cached;
  }

  const boards = await fetchBoards(mondayToken);
  if (!boards.length) throw new Error('No boards found. Check your Monday.com API token and workspace.');

  // Detect board types
  const boardsTyped = boards.map(b => ({
    ...b,
    type: detectBoardType(b.name, b.columns || [])
  }));

  // Find deals and work orders boards
  let dealsBoard = boardsTyped.find(b => b.type === 'deals');
  let workOrdersBoard = boardsTyped.find(b => b.type === 'work_orders');

  // Fallback: match by name keywords if type detection misses
  if (!dealsBoard) {
    dealsBoard = boardsTyped.find(b =>
      b.name.toLowerCase().includes('deal') ||
      b.name.toLowerCase().includes('funnel') ||
      b.name.toLowerCase().includes('pipeline')
    );
  }
  if (!workOrdersBoard) {
    workOrdersBoard = boardsTyped.find(b =>
      b.name.toLowerCase().includes('work order') ||
      b.name.toLowerCase().includes('tracker') ||
      b.name.toLowerCase().includes('work_order')
    );
  }

  const result = {
    boards: boardsTyped,
    boardNames: {
      deals: dealsBoard?.name || null,
      workOrders: workOrdersBoard?.name || null
    },
    dealsItems: null,
    workOrdersItems: null,
    dealsStats: null,
    workOrdersStats: null,
    crossAnalysis: null,
    loadedAt: new Date().toISOString()
  };

  // Load Deals
  if (dealsBoard) {
    try {
      const { columns, items } = await fetchAllBoardItems(dealsBoard.id, mondayToken);
      const normalized = items.map(item => normalizeItem(item, columns));
      result.dealsItems = normalized.map(cleanDealItem);
      result.dealsStats = analyzeDeals(result.dealsItems);
    } catch (err) {
      console.error('Error loading deals board:', err.message);
    }
  }

  // Load Work Orders
  if (workOrdersBoard) {
    try {
      const { columns, items } = await fetchAllBoardItems(workOrdersBoard.id, mondayToken);
      const normalized = items.map(item => normalizeItem(item, columns));
      result.workOrdersItems = normalized.map(cleanWorkOrderItem);
      result.workOrdersStats = analyzeWorkOrders(result.workOrdersItems);
    } catch (err) {
      console.error('Error loading work orders board:', err.message);
    }
  }

  // Cross analysis
  if (result.dealsItems && result.workOrdersItems) {
    result.crossAnalysis = crossBoardAnalysis(result.dealsItems, result.workOrdersItems);
  }

  setCached(mondayToken, result);
  return result;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const aiReady = process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY;
  res.json({ status: 'ok', ai_provider: aiProvider, version: '1.0.0' });
});

// Connect and load board summary
app.post('/api/connect', async (req, res) => {
  const token = req.headers['x-monday-token'] || req.body.token;
  if (!token) return res.status(400).json({ error: 'Monday.com API token required.' });

  try {
    const data = await loadMondayData(token, true);
    res.json({
      success: true,
      summary: {
        boards: data.boards.map(b => ({ id: b.id, name: b.name, type: b.type, items: b.items_count })),
        boardNames: data.boardNames,
        dealsCount: data.dealsItems?.length || 0,
        workOrdersCount: data.workOrdersItems?.length || 0,
        loadedAt: data.loadedAt
      }
    });
  } catch (err) {
    console.error('Connect error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Chat
app.post('/api/chat', async (req, res) => {
  const token = req.headers['x-monday-token'] || req.body.token;
  const { message, conversationHistory = [] } = req.body;

  if (!token) return res.status(400).json({ error: 'Monday.com token required.' });
  if (!message?.trim()) return res.status(400).json({ error: 'Message is empty.' });

  const aiReady = true;
  if (!aiReady) return res.status(500).json({ error: 'No AI key configured. Add GEMINI_API_KEY or ANTHROPIC_API_KEY to your .env file.' });

  try {
    const dataContext = await loadMondayData(token);
    const response = await processQuery(message, conversationHistory, dataContext);
    res.json({ success: true, response, dataTimestamp: dataContext.loadedAt });
  } catch (err) {
    console.error('Chat error:', err.message);
    const status = err.message.includes('token') || err.message.includes('401') ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

// Leadership update
app.post('/api/leadership-update', async (req, res) => {
  const token = req.headers['x-monday-token'] || req.body.token;
  if (!token) return res.status(400).json({ error: 'Token required.' });

  try {
    const dataContext = await loadMondayData(token);
    const update = await generateLeadershipUpdate(dataContext);
    res.json({ success: true, update, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh cache
app.post('/api/refresh', async (req, res) => {
  const token = req.headers['x-monday-token'] || req.body.token;
  if (!token) return res.status(400).json({ error: 'Token required.' });
  try {
    const data = await loadMondayData(token, true);
    res.json({ success: true, dealsCount: data.dealsItems?.length || 0, workOrdersCount: data.workOrdersItems?.length || 0, loadedAt: data.loadedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List boards
app.get('/api/boards', async (req, res) => {
  const token = req.headers['x-monday-token'];eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjYzMTAwNTU4OSwiYWFpIjoxMSwidWlkIjoxMDA4MTI5OTcsIm
  if (!token) return res.status(400).json({ error: 'Token required in x-monday-token header.' });
  try {
    const data = await loadMondayData(token);
    res.json({ boards: data.boards.map(b => ({ id: b.id, name: b.name, type: b.type, items: b.items_count })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.listen(PORT, () => {
  const aiProvider = process.env.GEMINI_API_KEY ? 'Gemini ✓' : process.env.ANTHROPIC_API_KEY ? 'Anthropic ✓' : '✗ NOT SET';
  console.log(`
╔══════════════════════════════════════════╗
║   🚁 Skylark BI Agent - Backend Ready   ║
║   Port  : ${PORT}                            ║
║   AI    : ${aiProvider.padEnd(30)}║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
