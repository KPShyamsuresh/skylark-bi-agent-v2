// mondayClient.js - Monday.com GraphQL API client

const axios = require('axios');
const MONDAY_API_URL = 'https://api.monday.com/v2';

async function mondayQuery(query, variables = {}, apiToken) {
  try {
    const response = await axios.post(
      MONDAY_API_URL,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiToken,
          'API-Version': '2024-01'
        },
        timeout: 20000
      }
    );
    if (response.data.errors) {
      throw new Error(response.data.errors.map(e => e.message).join('; '));
    }
    return response.data.data;
  } catch (err) {
    if (err.response?.status === 401) throw new Error('Invalid Monday.com API token.');
    if (err.response?.status === 429) throw new Error('Monday.com rate limit hit. Wait a moment and retry.');
    if (err.code === 'ECONNABORTED') throw new Error('Monday.com request timed out.');
    throw err;
  }
}

async function fetchBoards(apiToken) {
  const query = `
    query {
      boards(limit: 50) {
        id
        name
        items_count
        columns { id title type }
      }
    }
  `;
  const data = await mondayQuery(query, {}, apiToken);
  return data.boards || [];
}

async function fetchBoardItems(boardId, apiToken, cursor = null) {
  const query = `
    query ($boardId: ID!, $cursor: String) {
      boards(ids: [$boardId]) {
        id
        name
        columns { id title type }
        items_page(limit: 100, cursor: $cursor) {
          cursor
          items {
            id
            name
            state
            column_values {
              id
              text
              value
              type
              column { title type }
            }
          }
        }
      }
    }
  `;
  const data = await mondayQuery(query, { boardId: String(boardId), cursor }, apiToken);
  const board = data.boards?.[0];
  if (!board) return { items: [], columns: [], boardName: '', nextCursor: null };
  return {
    boardName: board.name,
    columns: board.columns,
    items: board.items_page?.items || [],
    nextCursor: board.items_page?.cursor || null
  };
}

async function fetchAllBoardItems(boardId, apiToken) {
  let allItems = [], columns = [], boardName = '', cursor = null, pages = 0;
  do {
    const result = await fetchBoardItems(boardId, apiToken, cursor);
    allItems = allItems.concat(result.items);
    columns = result.columns;
    boardName = result.boardName;
    cursor = result.nextCursor;
    pages++;
  } while (cursor && pages < 20);
  return { boardName, columns, items: allItems };
}

/**
 * Convert a Monday.com item + columns into a flat object
 * with both the column title AND a snake_case version as keys
 */
function normalizeItem(item, columns) {
  const normalized = {
    id: item.id,
    name: item.name || 'Unnamed',
    _raw: {}
  };

  item.column_values?.forEach(cv => {
    const colTitle = cv.column?.title || cv.id;

    let value = null;
    if (cv.text && cv.text.trim() !== '') {
      value = cv.text.trim();
    } else if (cv.value) {
      try {
        const parsed = JSON.parse(cv.value);
        if (parsed?.text) value = parsed.text;
        else if (parsed?.label) value = parsed.label;
        else if (parsed?.name) value = parsed.name;
        else if (parsed?.date) value = parsed.date;
        else if (typeof parsed === 'number') value = String(parsed);
      } catch {
        value = cv.value;
      }
    }

    // Store with original title key
    normalized[colTitle] = value;
    // Also store with snake_case key
    const snakeKey = colTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    normalized[snakeKey] = value;
    // Store in _raw for fallback
    normalized._raw[colTitle] = { text: cv.text, value: cv.value, type: cv.type };
  });

  return normalized;
}

/**
 * Detect board type: 'deals' | 'work_orders' | 'unknown'
 * Matches Skylark's actual board names and column patterns
 */
function detectBoardType(boardName, columns) {
  const name = boardName.toLowerCase();
  const colTitles = columns.map(c => c.title.toLowerCase()).join(' ');

  // Deals board signals
  if (name.includes('deal') || name.includes('funnel') || name.includes('pipeline') || name.includes('sales') ||
      colTitles.includes('deal stage') || colTitles.includes('closure probability') || colTitles.includes('masked deal value')) {
    return 'deals';
  }

  // Work orders board signals
  if (name.includes('work order') || name.includes('work_order') || name.includes('tracker') ||
      colTitles.includes('execution status') || colTitles.includes('bd/kam') || colTitles.includes('billed value')) {
    return 'work_orders';
  }

  return 'unknown';
}

module.exports = {
  mondayQuery, fetchBoards,
  fetchAllBoardItems, normalizeItem, detectBoardType
};
