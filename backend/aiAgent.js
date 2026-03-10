const Groq = require('groq-sdk');
const { formatCurrency } = require('./dataEngine');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildSystemPrompt(dataContext) {
  const { dealsStats, workOrdersStats, crossAnalysis, boardNames } = dataContext;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return `You are Skylark BI Agent, a business intelligence assistant for Skylark Drones, an Indian drone services company.
You have live data from their Monday.com boards. Give concise, founder-level insights.

TODAY: ${today}

STYLE:
- Lead with the answer and key numbers first
- Use rupee symbol for all currency
- Bold important numbers using **bold**
- End with 1-2 follow-up questions

BOARDS: Deals="${boardNames.deals || 'Not found'}" | WorkOrders="${boardNames.workOrders || 'Not found'}"

${dealsStats ? `
DEALS PIPELINE (${dealsStats.total_deals} deals):
- Total Pipeline: ${formatCurrency(dealsStats.total_pipeline_value)}
- Open: ${dealsStats.open.count} deals, ${formatCurrency(dealsStats.open.value)}
- Won: ${dealsStats.won.count} deals, ${formatCurrency(dealsStats.won.value)}
- Lost: ${dealsStats.lost.count} deals, ${formatCurrency(dealsStats.lost.value)}
- On Hold: ${dealsStats.on_hold.count} deals, ${formatCurrency(dealsStats.on_hold.value)}
- Avg Deal Size: ${formatCurrency(dealsStats.avg_deal_size)}
- Closing This Quarter: ${dealsStats.closing_this_quarter.length} deals

By Sector: ${Object.entries(dealsStats.by_sector).sort((a,b)=>b[1].value-a[1].value).map(([s,d])=>`${s}: ${d.count} deals ${formatCurrency(d.value)}`).join(' | ')}
By Stage: ${Object.entries(dealsStats.by_stage).sort((a,b)=>b[1].value-a[1].value).slice(0,6).map(([s,d])=>`${s}: ${d.count}`).join(' | ')}
By Owner: ${Object.entries(dealsStats.by_owner).map(([s,d])=>`${s}: ${d.count} deals ${formatCurrency(d.value)}`).join(' | ')}
Top Deals: ${dealsStats.top_deals.slice(0,5).map((d,i)=>`${i+1}. ${d.name}: ${formatCurrency(d.value)} [${d.stage||'?'}] [${d.sector}]`).join(' | ')}
` : 'No deals data.'}

${workOrdersStats ? `
WORK ORDERS (${workOrdersStats.total_orders} orders):
- Contract Value: ${formatCurrency(workOrdersStats.total_contract_value)}
- Billed: ${formatCurrency(workOrdersStats.total_billed)}
- Collected: ${formatCurrency(workOrdersStats.total_collected)}
- Receivable: ${formatCurrency(workOrdersStats.total_receivable)}
- To Be Billed: ${formatCurrency(workOrdersStats.total_to_be_billed)}
- Collection Efficiency: ${workOrdersStats.collection_efficiency}%
- Completed: ${workOrdersStats.completed.length} | Ongoing: ${workOrdersStats.ongoing.length} | Not Started: ${workOrdersStats.not_started.length} | Overdue: ${workOrdersStats.overdue.length}

By Sector: ${Object.entries(workOrdersStats.by_sector).sort((a,b)=>b[1].value-a[1].value).map(([s,d])=>`${s}: ${d.count} orders ${formatCurrency(d.value)}`).join(' | ')}
By Owner: ${Object.entries(workOrdersStats.by_owner).sort((a,b)=>b[1].count-a[1].count).map(([s,d])=>`${s}: ${d.count} orders`).join(' | ')}
By Status: ${Object.entries(workOrdersStats.by_status).sort((a,b)=>b[1].count-a[1].count).map(([s,d])=>`${s}: ${d.count}`).join(' | ')}
${workOrdersStats.overdue.length > 0 ? `Overdue: ${workOrdersStats.overdue.slice(0,3).map(o=>`${o.name} (${o.days_overdue} days)`).join(', ')}` : ''}
` : 'No work orders data.'}

${crossAnalysis ? `CROSS BOARD BY SECTOR: ${Object.entries(crossAnalysis.by_sector).sort((a,b)=>(b[1].deal_value+b[1].wo_value)-(a[1].deal_value+a[1].wo_value)).map(([s,d])=>`${s}: ${d.deal_count} deals(${formatCurrency(d.deal_value)}) vs ${d.wo_count} orders(${formatCurrency(d.wo_value)})`).join(' | ')}` : ''}

For leadership updates use: Executive Summary, Pipeline Health, Operations, Sector Highlights, Risks, Actions.
Use markdown formatting.`;
}

async function processQuery(userMessage, conversationHistory, dataContext) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(dataContext) },
    ...conversationHistory.slice(-10),
    { role: 'user', content: userMessage }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1500,
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

async function generateLeadershipUpdate(dataContext) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(dataContext) },
    {
      role: 'user',
      content: `Generate a leadership update for Skylark Drones with these sections:
1. Executive Summary (2-3 sentences)
2. Pipeline Health (deal numbers, stages, sectors)
3. Operational Performance (work orders, billing, collections)
4. Sector Highlights (top 2-3 sectors)
5. Risks and Watch Items
6. Recommended Actions This Week (3 bullet points)
Use actual numbers from the data. Keep under 450 words. Use markdown.`
    }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1200,
    temperature: 0.3
  });

  return response.choices[0].message.content;
}

module.exports = { processQuery, generateLeadershipUpdate, buildSystemPrompt };
