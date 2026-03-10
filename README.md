# 🚁 Skylark Drones — Monday.com BI Agent

An AI-powered business intelligence chatbot that connects to your Monday.com workspace and answers founder-level queries about your pipeline, revenue, and operations in real time.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend (index.html)                │
│   • Single-file HTML/CSS/JS chatbot UI           │
│   • Connects to backend via REST API             │
│   • Stores Monday.com token in localStorage      │
└─────────────────────────┬────────────────────────┘
                          │ HTTP
┌─────────────────────────▼────────────────────────┐
│           Backend (Node.js/Express)               │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ mondayClient │  │  dataEngine  │              │
│  │  • GraphQL   │  │  • Cleaning  │              │
│  │  • Pagination│  │  • Analytics │              │
│  │  • Auth      │  │  • Normalize │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                       │
│  ┌──────▼─────────────────▼───────┐              │
│  │         aiAgent.js             │              │
│  │  Claude claude-opus-4-5 (Sonnet)        │              │
│  │  • System prompt w/ live data │              │
│  │  • Conversation history       │              │
│  │  • Leadership update gen      │              │
│  └────────────────────────────────┘              │
└─────────────────────────┬────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │   Monday.com API v2    │
              │   (GraphQL, Read-only) │
              └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | Zero build step, single file, easy to host anywhere |
| Backend | Node.js + Express | Lightweight, fast, great ecosystem for API work |
| AI | Anthropic Claude (claude-opus-4-5) | Best-in-class reasoning for business queries |
| Monday.com | REST GraphQL API v2 | Full data access, pagination support, no MCP needed |
| Hosting | Render / Railway / Vercel | Free tiers available, easy deployment |

---

## Project Structure

```
skylark/
├── backend/
│   ├── server.js          # Express app, routes, caching
│   ├── mondayClient.js    # Monday.com GraphQL client
│   ├── dataEngine.js      # Data cleaning & analytics
│   ├── aiAgent.js         # Claude AI integration
│   ├── package.json
│   └── .env.example
└── frontend/
    └── index.html         # Complete single-file UI
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Monday.com account with API access
- Anthropic API key

### Step 1: Configure Monday.com

1. Go to **monday.com** → click your avatar → **Admin** → **API**
2. Copy your **Personal API Token** (v2)
3. Import the two CSV files as separate boards:
   - **Deals** board — your sales pipeline data
   - **Work Orders** board — your project execution data
4. Make sure column types match (numbers for values, dates for dates)

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   PORT=3001

# Start the server
npm start
# Development: npm run dev
```

The server starts at `http://localhost:3001`

### Step 3: Frontend Setup

No build step required. Just open `frontend/index.html` in a browser or serve it:

```bash
# Option 1: Python simple server
cd frontend && python3 -m http.server 3000

# Option 2: npx serve
npx serve frontend -p 3000
```

Then open `http://localhost:3000`

### Step 4: Connect

1. Open the frontend in your browser
2. Enter your Monday.com API token
3. Enter your backend URL (`http://localhost:3001`)
4. Click **Connect & Load Data**

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/connect` | Verify token & load board summary |
| POST | `/api/chat` | Send a message, get AI response |
| POST | `/api/leadership-update` | Generate executive update |
| POST | `/api/refresh` | Force refresh Monday.com data |
| GET | `/api/boards` | List boards and stats |

---

## Deployment (Render.com — Free)

### Backend
1. Push code to GitHub
2. Create a new **Web Service** on render.com
3. Connect your repo, set root to `backend/`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add environment variables: `ANTHROPIC_API_KEY`, `PORT=10000`

### Frontend
1. Create a new **Static Site** on render.com
2. Set root to `frontend/`
3. No build command needed
4. Update the default API URL in `index.html` to your backend URL

---

## Sample Queries

- *"How's our pipeline looking for energy sector this quarter?"*
- *"Show me top 5 deals by value"*
- *"Which team member has the most work orders?"*
- *"What's our win rate this month?"*
- *"Are there any overdue work orders?"*
- *"Give me a leadership update"*
- *"Compare deals pipeline vs executed work orders by sector"*

---

## Data Handling

The agent handles messy real-world data gracefully:
- **Missing values**: Flagged with data coverage % in responses
- **Inconsistent dates**: Auto-normalized (DD/MM/YYYY, ISO, etc.)
- **Currency formats**: Strips ₹/$/, commas, spaces
- **Sector naming**: Normalized (e.g., "Oil & Gas" → "Energy")
- **Board detection**: Auto-identifies deals vs work orders boards
- **Pagination**: Fetches all items regardless of board size

---

## Decision Log

See `DECISION_LOG.md` for full technical decisions and trade-offs.
