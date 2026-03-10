// dataEngine.js - Tailored to Skylark's actual Monday.com board columns
//
// WORK ORDERS columns: Deal name masked, Customer Name Code, Serial #,
//   Nature of Work, Last executed month, Execution Status, Data Delivery Date,
//   Date of PO/LOI, Document Type, Probable Start Date, Probable End Date,
//   BD/KAM Personnel code, Sector, Type of Work, [software platform?],
//   Last invoice date, latest invoice no., Amount in Rupees (Excl GST)(Masked),
//   Amount in Rupees (Incl GST)(Masked), Billed Value Excl GST, Billed Value Incl GST,
//   Collected Amount, Amount to be billed Excl GST, Amount to be billed Incl GST,
//   Amount Receivable, AR Priority, Qty by Ops, Qty as per PO, Qty billed,
//   Balance qty, Invoice Status, Expected Billing Month, Actual Billing Month,
//   Actual Collection Month, WO Status (billed), Collection status, Collection Date, Billing Status
//
// DEALS columns: Deal Name, Owner code, Client Code, Deal Status,
//   Close Date (A), Closure Probability, Masked Deal value, Tentative Close Date,
//   Deal Stage, Product deal, Sector/service, Created Date

function getVal(item, rawKey, altKeys = []) {
  // Try the item directly with various key formats
  const allKeys = [rawKey, ...altKeys];
  for (const key of allKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return String(item[key]).trim();
    // lowercase underscore version
    const lk = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (item[lk] !== undefined && item[lk] !== null && item[lk] !== '') return String(item[lk]).trim();
  }
  // Try _raw object
  if (item._raw) {
    for (const key of allKeys) {
      if (item._raw[key]?.text && item._raw[key].text.trim() !== '') return item._raw[key].text.trim();
    }
  }
  return null;
}

function parseCurrency(val) {
  if (!val && val !== 0) return null;
  const str = String(val).replace(/[₹$€£,\s]/g, '').trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a') return null;
  const num = parseFloat(str);
  return isNaN(num) || num === 0 ? null : num;
}

function normalizeDate(val) {
  if (!val || val === '' || val === 'null' || val === 'N/A' || val === '-') return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${year}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function normalizeSector(sector) {
  if (!sector || sector.trim() === '') return 'Unknown';
  const s = sector.trim();
  const lower = s.toLowerCase();
  if (lower.includes('mining')) return 'Mining';
  if (lower.includes('powerline') || lower.includes('power line')) return 'Powerline';
  if (lower.includes('renew') || lower.includes('solar') || lower.includes('wind')) return 'Renewables';
  if (lower.includes('construction') || lower.includes('infra')) return 'Construction';
  if (lower.includes('railway') || lower.includes('rail')) return 'Railways';
  if (lower.includes('aviation') || lower.includes('airport')) return 'Aviation';
  if (lower.includes('security') || lower.includes('surveillance')) return 'Security & Surveillance';
  if (lower.includes('manufactur')) return 'Manufacturing';
  if (lower.includes('dsp')) return 'DSP';
  if (lower.includes('tender')) return 'Tender';
  if (lower.includes('others') || lower.includes('other')) return 'Others';
  return s;
}

function cleanWorkOrderItem(item) {
  return {
    _id: item.id,
    name:           getVal(item, 'Deal name masked', ['deal_name_masked', 'name']) || item.name || 'Unnamed',
    client:         getVal(item, 'Customer Name Code', ['customer_name_code']),
    serial:         getVal(item, 'Serial #', ['serial__']),
    nature:         getVal(item, 'Nature of Work', ['nature_of_work']),
    type_of_work:   getVal(item, 'Type of Work', ['type_of_work']),
    sector:         normalizeSector(getVal(item, 'Sector', ['sector'])),
    status:         getVal(item, 'Execution Status', ['execution_status']),
    wo_status:      getVal(item, 'WO Status (billed)', ['wo_status__billed_']),
    billing_status: getVal(item, 'Billing Status', ['billing_status']),
    invoice_status: getVal(item, 'Invoice Status', ['invoice_status']),
    collection_status: getVal(item, 'Collection status', ['collection_status']),
    owner:          getVal(item, 'BD/KAM Personnel code', ['bd_kam_personnel_code']),
    start_date:     normalizeDate(getVal(item, 'Probable Start Date', ['probable_start_date'])),
    end_date:       normalizeDate(getVal(item, 'Probable End Date', ['probable_end_date'])),
    po_date:        normalizeDate(getVal(item, 'Date of PO/LOI', ['date_of_po_loi'])),
    delivery_date:  normalizeDate(getVal(item, 'Data Delivery Date', ['data_delivery_date'])),
    last_invoice_date: normalizeDate(getVal(item, 'Last invoice date', ['last_invoice_date'])),
    amount:         parseCurrency(getVal(item, 'Amount in Rupees (Excl of GST) (Masked)', ['amount_in_rupees__excl_of_gst___masked_'])),
    amount_incl_gst: parseCurrency(getVal(item, 'Amount in Rupees (Incl of GST) (Masked)', ['amount_in_rupees__incl_of_gst___masked_'])),
    billed_excl:    parseCurrency(getVal(item, 'Billed Value in Rupees (Excl of GST.) (Masked)', ['billed_value_in_rupees__excl_of_gst____masked_'])),
    billed_incl:    parseCurrency(getVal(item, 'Billed Value in Rupees (Incl of GST.) (Masked)', ['billed_value_in_rupees__incl_of_gst____masked_'])),
    collected:      parseCurrency(getVal(item, 'Collected Amount in Rupees (Incl of GST.) (Masked)', ['collected_amount_in_rupees__incl_of_gst____masked_'])),
    to_be_billed:   parseCurrency(getVal(item, 'Amount to be billed in Rs. (Exl. of GST) (Masked)', ['amount_to_be_billed_in_rs___exl__of_gst___masked_'])),
    receivable:     parseCurrency(getVal(item, 'Amount Receivable (Masked)', ['amount_receivable__masked_'])),
    ar_priority:    getVal(item, 'AR Priority account', ['ar_priority_account']),
    document_type:  getVal(item, 'Document Type', ['document_type']),
    recurring_month: getVal(item, 'Last executed month of recurring project', ['last_executed_month_of_recurring_project']),
  };
}

function cleanDealItem(item) {
  return {
    _id: item.id,
    name:           getVal(item, 'Deal Name', ['deal_name', 'name']) || item.name || 'Unnamed',
    owner:          getVal(item, 'Owner code', ['owner_code']),
    client:         getVal(item, 'Client Code', ['client_code']),
    status:         getVal(item, 'Deal Status', ['deal_status']),
    stage:          getVal(item, 'Deal Stage', ['deal_stage']),
    sector:         normalizeSector(getVal(item, 'Sector/service', ['sector_service'])),
    product:        getVal(item, 'Product deal', ['product_deal']),
    probability:    getVal(item, 'Closure Probability', ['closure_probability']),
    value:          parseCurrency(getVal(item, 'Masked Deal value', ['masked_deal_value'])),
    close_date:     normalizeDate(getVal(item, 'Close Date (A)', ['close_date__a_'])),
    tentative_close: normalizeDate(getVal(item, 'Tentative Close Date', ['tentative_close_date'])),
    created_date:   normalizeDate(getVal(item, 'Created Date', ['created_date'])),
  };
}

function analyzeWorkOrders(items) {
  const now = new Date();
  const quarterStart = getQuarterStart(now);
  const quarterEnd = getQuarterEnd(now);

  const stats = {
    total_orders: items.length,
    total_contract_value: 0,
    total_billed: 0,
    total_collected: 0,
    total_receivable: 0,
    total_to_be_billed: 0,
    by_status: {},
    by_sector: {},
    by_owner: {},
    by_nature: {},
    completed: [],
    ongoing: [],
    not_started: [],
    overdue: [],
    ar_priority_accounts: [],
    this_quarter_completed: { count: 0, value: 0 },
    collection_efficiency: 0,
    avg_contract_value: 0,
    data_coverage: {}
  };

  let valueCount = 0;

  items.forEach(o => {
    const val = o.amount || 0;
    const billed = o.billed_excl || 0;
    const collected = o.collected || 0;

    stats.total_contract_value += val;
    stats.total_billed += billed;
    stats.total_collected += collected;
    stats.total_receivable += (o.receivable || 0);
    stats.total_to_be_billed += (o.to_be_billed || 0);
    if (o.amount) valueCount++;

    const status = o.status || 'Unknown';
    if (!stats.by_status[status]) stats.by_status[status] = { count: 0, value: 0 };
    stats.by_status[status].count++;
    stats.by_status[status].value += val;

    const sector = o.sector || 'Unknown';
    if (!stats.by_sector[sector]) stats.by_sector[sector] = { count: 0, value: 0, billed: 0, collected: 0 };
    stats.by_sector[sector].count++;
    stats.by_sector[sector].value += val;
    stats.by_sector[sector].billed += billed;
    stats.by_sector[sector].collected += collected;

    const owner = o.owner || 'Unassigned';
    if (!stats.by_owner[owner]) stats.by_owner[owner] = { count: 0, value: 0 };
    stats.by_owner[owner].count++;
    stats.by_owner[owner].value += val;

    const nature = o.nature || 'Unknown';
    if (!stats.by_nature[nature]) stats.by_nature[nature] = { count: 0, value: 0 };
    stats.by_nature[nature].count++;
    stats.by_nature[nature].value += val;

    const sl = status.toLowerCase();
    if (sl.includes('complet')) {
      stats.completed.push(o);
      const ed = o.end_date ? new Date(o.end_date) : null;
      if (ed && ed >= quarterStart && ed <= quarterEnd) {
        stats.this_quarter_completed.count++;
        stats.this_quarter_completed.value += val;
      }
    } else if (sl.includes('ongoing') || sl.includes('executed')) {
      stats.ongoing.push(o);
    } else if (sl.includes('not started')) {
      stats.not_started.push(o);
    }

    if (o.end_date && !sl.includes('complet')) {
      const ed = new Date(o.end_date);
      if (ed < now) {
        stats.overdue.push({ ...o, days_overdue: Math.floor((now - ed) / 86400000) });
      }
    }

    if (o.ar_priority && !['no','none',''].includes(o.ar_priority.toLowerCase())) {
      stats.ar_priority_accounts.push(o);
    }
  });

  stats.avg_contract_value = valueCount > 0 ? Math.round(stats.total_contract_value / valueCount) : 0;
  stats.collection_efficiency = stats.total_billed > 0
    ? Math.round((stats.total_collected / stats.total_billed) * 100) : 0;
  stats.overdue.sort((a, b) => b.days_overdue - a.days_overdue);

  const fields = ['amount', 'status', 'sector', 'owner', 'end_date', 'client'];
  fields.forEach(f => {
    const filled = items.filter(o => o[f]).length;
    stats.data_coverage[f] = `${Math.round((filled / items.length) * 100)}%`;
  });

  return stats;
}

function analyzeDeals(items) {
  const now = new Date();
  const quarterEnd = getQuarterEnd(now);

  const stats = {
    total_deals: items.length,
    total_pipeline_value: 0,
    by_stage: {},
    by_status: {},
    by_sector: {},
    by_owner: {},
    by_probability: {},
    won: { count: 0, value: 0 },
    lost: { count: 0, value: 0 },
    open: { count: 0, value: 0 },
    on_hold: { count: 0, value: 0 },
    closing_this_quarter: [],
    top_deals: [],
    avg_deal_size: 0,
    data_coverage: {}
  };

  let valueCount = 0;

  items.forEach(d => {
    const val = d.value || 0;
    stats.total_pipeline_value += val;
    if (d.value) valueCount++;

    const stage = d.stage || 'Unknown';
    if (!stats.by_stage[stage]) stats.by_stage[stage] = { count: 0, value: 0 };
    stats.by_stage[stage].count++;
    stats.by_stage[stage].value += val;

    const status = d.status || 'Unknown';
    if (!stats.by_status[status]) stats.by_status[status] = { count: 0, value: 0 };
    stats.by_status[status].count++;
    stats.by_status[status].value += val;

    const sl = status.toLowerCase();
    const stageL = stage.toLowerCase();
    if (sl === 'won' || stageL.includes('g. project won') || stageL.includes('project completed')) {
      stats.won.count++; stats.won.value += val;
    } else if (sl === 'dead' || stageL.includes('l. project lost') || stageL.includes('not relevant')) {
      stats.lost.count++; stats.lost.value += val;
    } else if (sl === 'on hold' || stageL.includes('on hold')) {
      stats.on_hold.count++; stats.on_hold.value += val;
    } else {
      stats.open.count++; stats.open.value += val;
    }

    const sector = d.sector || 'Unknown';
    if (!stats.by_sector[sector]) stats.by_sector[sector] = { count: 0, value: 0 };
    stats.by_sector[sector].count++;
    stats.by_sector[sector].value += val;

    const owner = d.owner || 'Unassigned';
    if (!stats.by_owner[owner]) stats.by_owner[owner] = { count: 0, value: 0 };
    stats.by_owner[owner].count++;
    stats.by_owner[owner].value += val;

    const prob = d.probability || 'Unknown';
    if (!stats.by_probability[prob]) stats.by_probability[prob] = { count: 0, value: 0 };
    stats.by_probability[prob].count++;
    stats.by_probability[prob].value += val;

    const closeDate = d.tentative_close ? new Date(d.tentative_close) : (d.close_date ? new Date(d.close_date) : null);
    if (closeDate && closeDate >= now && closeDate <= quarterEnd) {
      stats.closing_this_quarter.push(d);
    }
  });

  stats.closing_this_quarter.sort((a, b) => (b.value || 0) - (a.value || 0));
  stats.top_deals = items.filter(d => d.value).sort((a, b) => b.value - a.value).slice(0, 10);
  stats.avg_deal_size = valueCount > 0 ? Math.round(stats.total_pipeline_value / valueCount) : 0;

  const fields = ['value', 'stage', 'sector', 'owner', 'tentative_close', 'probability'];
  fields.forEach(f => {
    const filled = items.filter(d => d[f]).length;
    stats.data_coverage[f] = `${Math.round((filled / items.length) * 100)}%`;
  });

  return stats;
}

function crossBoardAnalysis(deals, workOrders) {
  const sectorMap = {};
  deals.forEach(d => {
    const s = d.sector || 'Unknown';
    if (!sectorMap[s]) sectorMap[s] = { deal_count: 0, deal_value: 0, wo_count: 0, wo_value: 0 };
    sectorMap[s].deal_count++;
    sectorMap[s].deal_value += d.value || 0;
  });
  workOrders.forEach(w => {
    const s = w.sector || 'Unknown';
    if (!sectorMap[s]) sectorMap[s] = { deal_count: 0, deal_value: 0, wo_count: 0, wo_value: 0 };
    sectorMap[s].wo_count++;
    sectorMap[s].wo_value += w.amount || 0;
  });
  return { by_sector: sectorMap };
}

function getQuarterStart(date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

function getQuarterEnd(date) {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), (q + 1) * 3, 0);
}

function formatCurrency(value) {
  if (!value && value !== 0) return 'N/A';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

module.exports = {
  cleanWorkOrderItem, cleanDealItem,
  analyzeWorkOrders, analyzeDeals,
  crossBoardAnalysis, normalizeSector,
  parseCurrency, normalizeDate,
  formatCurrency, getQuarterStart, getQuarterEnd
};
