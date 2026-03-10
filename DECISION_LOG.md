# Decision Log — Skylark BI Agent

**Author:** Skylark Drones Engineering  
**Date:** 2025  
**Time Budget:** 6 hours

---

## Key Assumptions

1. **Monday.com board naming is flexible** — The agent uses heuristic detection (keywords in board name + column titles) to identify which board is "Deals" vs "Work Orders," rather than requiring exact names. This handles real-world naming inconsistencies.

2. **Indian Rupee (₹) is the primary currency** — Skylark is an Indian drone company; all currency values are assumed INR unless data suggests otherwise.

3. **Data is append-only / read-only** — We only read from Monday.com, never write. No pagination edge cases require retry logic beyond the 20-page safety limit.

4. **Founder-level means "give me insight, not data"** — Queries like "how's our pipeline?" should return analysis with context, risks, and recommendations — not a raw table dump.

5. **Session-based caching (5 min) is acceptable** — Monday.com data doesn't change in real-time during a conversation. A 5-minute TTL avoids rate limits while keeping data fresh.

---

## Trade-offs

### API vs MCP
**Chose:** Direct Monday.com GraphQL API  
**Why:** MCP (Model Context Protocol) adds deployment complexity and requires a local MCP server running. The direct API approach works identically in production without any local infrastructure. For a hosted prototype evaluated in 6 hours, this was the right call.  
**Trade-off:** MCP would give Claude native tool-use integration; API requires manual data feeding through the system prompt.

### Single-file frontend vs React/Next.js
**Chose:** Single HTML file  
**Why:** Zero build pipeline, deployable to any static host instantly, no Node.js dependency for frontend. Works by simply opening the file in a browser.  
**Trade-off:** No component reusability, all logic in one file. With more time, I'd use Next.js for better maintainability.

### System prompt data injection vs tool calling
**Chose:** Inject all analytics into system prompt  
**Why:** More reliable for business intelligence — Claude has the full data context and can cross-reference without needing multiple tool calls. Faster responses.  
**Trade-off:** System prompt gets large with big datasets. With >500 items, we'd need to summarize data more aggressively or use tool calling.

### In-memory cache vs Redis/persistent cache
**Chose:** In-memory Map with TTL  
**Why:** Zero infrastructure overhead for a prototype. Redis would require additional setup and cost.  
**Trade-off:** Cache is lost on server restart. Not a problem for a demo/prototype.

---

## What I'd Do With More Time

1. **Streaming responses** — Stream Claude's response token-by-token for better UX (currently wait for full response)
2. **Visualization layer** — Add Charts.js/Recharts to render pipeline charts, sector breakdowns, and trend lines inline
3. **Tool calling architecture** — Replace system prompt injection with proper Claude tool calls (get_deals, get_work_orders, analyze_sector, etc.) for more precise, on-demand data fetching
4. **Authentication** — Add proper user auth (NextAuth.js) so multiple team members can use the agent with their own Monday.com credentials
5. **Query memory** — Persist conversation history in a lightweight DB (SQLite/Turso) for context across sessions
6. **Monday.com webhooks** — Subscribe to board updates for real-time data refresh instead of polling

---

## Leadership Updates — Interpretation & Implementation

**Interpretation:** "Prepare data for leadership updates" means helping founders/execs generate concise, investor-ready business reviews without manually pulling data.

**Implementation:** The agent includes a dedicated "Leadership Update" feature (the 📊 button) that generates a structured weekly business review containing:
- Executive Summary (2-3 sentence overview)
- Pipeline Health (key deal metrics)
- Operational Performance (work order metrics)
- Sector Highlights (top performing verticals)
- Risks & Watch Items (overdue orders, stalled deals)
- Key Actions This Week (3 concrete next steps)

This output is formatted in markdown and can be directly copy-pasted into an email, Slack message, or investor update. The "Copy" button in the modal makes this one-click.

The philosophy: a founder should be able to open the agent on Monday morning, click "Leadership Update," and have a board-ready summary in 10 seconds.
