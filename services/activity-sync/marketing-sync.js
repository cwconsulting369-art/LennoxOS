#!/usr/bin/env node
/**
 * Marketing Sync — Klaviyo + Airtable + Notion
 */
const { startRun, finishRun, noteMissingKey, resolveMissingKey, upsertMetrics, fetchJson, TODAY } = require('./lib');

// ---------- Klaviyo -------------------------------------------------------
async function syncKlaviyo() {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) {
    await noteMissingKey('klaviyo', 'KLAVIYO_API_KEY', 'lists:read campaigns:read metrics:read', 'Profiles/campaigns/flows', 'https://www.klaviyo.com/account#api-keys-tab');
    return { rows: 0, note: 'KLAVIYO_API_KEY missing' };
  }
  const runId = await startRun('klaviyo');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Klaviyo-API-Key ${key}`, accept: 'application/json', revision: '2024-10-15' } };

    // Account info (tier/plan)
    const acct = await fetchJson('https://a.klaviyo.com/api/accounts', auth);
    const profilesTotal = await fetchJson('https://a.klaviyo.com/api/profiles?page[size]=1', auth);
    const lists = await fetchJson('https://a.klaviyo.com/api/lists?page[size]=100', auth);
    const flows = await fetchJson('https://a.klaviyo.com/api/flows?page[size]=100', auth);
    const campaigns = await fetchJson('https://a.klaviyo.com/api/campaigns?filter=equals(messages.channel,%22email%22)&page[size]=50', auth);

    const today = TODAY();
    const metrics = [];
    if (acct.ok) {
      metrics.push({ day: today, vendor: 'klaviyo', metric_name: 'account_status', scope: '', value: 1, unit: 'state', raw: acct.body?.data?.[0]?.attributes || {} });
    }
    if (lists.ok)     metrics.push({ day: today, vendor: 'klaviyo', metric_name: 'lists_count',     scope: '', value: (lists.body?.data || []).length,     unit: 'count' });
    if (flows.ok)     metrics.push({ day: today, vendor: 'klaviyo', metric_name: 'flows_count',     scope: '', value: (flows.body?.data || []).length,     unit: 'count' });
    if (campaigns.ok) metrics.push({ day: today, vendor: 'klaviyo', metric_name: 'campaigns_count', scope: '', value: (campaigns.body?.data || []).length, unit: 'count' });
    if (profilesTotal.ok) {
      // total via X-Total or links — Klaviyo returns count in meta if requested
      // Fallback: just probe size of first page
      metrics.push({ day: today, vendor: 'klaviyo', metric_name: 'profiles_probe', scope: '', value: (profilesTotal.body?.data || []).length, unit: 'count' });
    }

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('klaviyo', 'KLAVIYO_API_KEY');
    await finishRun(runId, 'ok', rows);
    return { rows, lists: lists.body?.data?.length, flows: flows.body?.data?.length, campaigns: campaigns.body?.data?.length };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Airtable ------------------------------------------------------
async function syncAirtable() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    await noteMissingKey('airtable', 'AIRTABLE_TOKEN', 'data.records:read schema.bases:read', 'Bases/Tables/Records', 'https://airtable.com/create/tokens');
    return { rows: 0, note: 'AIRTABLE_TOKEN missing' };
  }
  const runId = await startRun('airtable');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // 1) List bases
    const bases = await fetchJson('https://api.airtable.com/v0/meta/bases', auth);
    if (!bases.ok) throw new Error(`meta/bases: ${bases.status} ${JSON.stringify(bases.body).slice(0, 150)}`);
    const baseList = bases.body?.bases || [];

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'airtable', metric_name: 'bases_total', scope: '', value: baseList.length, unit: 'count' },
    ];

    // 2) For first 5 bases, count tables
    let totalTables = 0;
    for (const b of baseList.slice(0, 5)) {
      const schema = await fetchJson(`https://api.airtable.com/v0/meta/bases/${b.id}/tables`, auth);
      if (schema.ok) {
        const tables = schema.body?.tables || [];
        totalTables += tables.length;
        metrics.push({ day: today, vendor: 'airtable', metric_name: 'tables_per_base', scope: b.name || b.id, value: tables.length, unit: 'count' });
      }
    }
    metrics.push({ day: today, vendor: 'airtable', metric_name: 'tables_sampled_total', scope: '', value: totalTables, unit: 'count' });

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('airtable', 'AIRTABLE_TOKEN');
    await finishRun(runId, 'ok', rows);
    return { rows, bases: baseList.length, sampled_tables: totalTables };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Notion --------------------------------------------------------
async function syncNotion() {
  const key = process.env.NOTION_API_KEY;
  if (!key) {
    await noteMissingKey('notion', 'NOTION_API_KEY', 'read', 'Workspace pages/databases', 'https://www.notion.so/my-integrations');
    return { rows: 0, note: 'NOTION_API_KEY missing' };
  }
  const runId = await startRun('notion');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${key}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' } };
    const search = await fetch('https://api.notion.com/v1/search', {
      ...auth, method: 'POST', body: JSON.stringify({ page_size: 100 }),
    });
    const j = await search.json();
    if (!search.ok) throw new Error(`search: ${search.status} ${JSON.stringify(j).slice(0, 150)}`);

    const results = j?.results || [];
    const pages = results.filter(r => r.object === 'page').length;
    const dbs = results.filter(r => r.object === 'database').length;
    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'notion', metric_name: 'pages_visible',     scope: '', value: pages, unit: 'count' },
      { day: today, vendor: 'notion', metric_name: 'databases_visible', scope: '', value: dbs, unit: 'count' },
      { day: today, vendor: 'notion', metric_name: 'items_visible',     scope: '', value: results.length, unit: 'count' },
    ];
    rows = await upsertMetrics(metrics);
    await resolveMissingKey('notion', 'NOTION_API_KEY');
    await finishRun(runId, 'ok', rows);
    return { rows, pages, databases: dbs };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

(async () => {
  console.log('--- Marketing Sync ---');
  console.log('Klaviyo:  ', await syncKlaviyo());
  console.log('Airtable: ', await syncAirtable());
  console.log('Notion:   ', await syncNotion());
})();
