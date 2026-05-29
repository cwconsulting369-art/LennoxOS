#!/usr/bin/env node
/**
 * Vendor-API Usage Sync
 *
 * Pulls daily usage from:
 *   - OpenRouter: /api/v1/credits + /api/v1/generation (last N requests)
 *   - OpenAI: /v1/organization/usage (or /v1/usage legacy)
 *   - Anthropic API: /v1/organizations/{org}/usage_report (needs admin key)
 *
 * Writes into vendor_usage_daily. Idempotent via day+vendor+model PK.
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(l => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...v] = t.split('=');
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  });
}
loadEnv('/home/carlos/lennox-os/.env');
loadEnv('/home/carlos/.claude/.env');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function startRun(source) {
  const { data } = await sb.from('activity_sync_runs').insert({ source, status: 'running' }).select('id').single();
  return data?.id;
}
async function finishRun(id, status, rows, err) {
  if (!id) return;
  await sb.from('activity_sync_runs').update({
    status, rows_processed: rows, finished_at: new Date().toISOString(), error: err || null,
  }).eq('id', id);
}

// ---------- OpenRouter ----------------------------------------------------
async function syncOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { rows: 0, note: 'OPENROUTER_API_KEY missing' };
  const runId = await startRun('openrouter');
  let rows = 0;
  try {
    // 1) Account credits / total spend
    const credR = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const cred = await credR.json();
    const totalCredits = cred?.data?.total_credits;
    const totalUsage = cred?.data?.total_usage;

    // 2) Per-generation history (last 100 by default; gets aggregated to daily-by-model)
    //    NOTE: OpenRouter doesn't expose a usage_by_day endpoint publicly; we use the activity feed
    let allGenerations = [];
    let offset = 0;
    for (let page = 0; page < 5; page++) {  // up to 500 recent
      const r = await fetch(`https://openrouter.ai/api/v1/activity?offset=${offset}&limit=100`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) break;
      const j = await r.json();
      const list = j?.data || [];
      allGenerations = allGenerations.concat(list);
      if (list.length < 100) break;
      offset += 100;
    }

    // Aggregate by day + model
    const agg = {};
    for (const g of allGenerations) {
      const ts = g.created_at || g.generation_time;
      if (!ts) continue;
      const day = (new Date(ts)).toISOString().slice(0, 10);
      const model = g.model || 'unknown';
      const key = `${day}|${model}`;
      if (!agg[key]) agg[key] = { day, vendor: 'openrouter', model, request_count: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      agg[key].request_count++;
      agg[key].input_tokens += g.tokens_prompt || g.native_tokens_prompt || 0;
      agg[key].output_tokens += g.tokens_completion || g.native_tokens_completion || 0;
      agg[key].cost_usd += parseFloat(g.usage || g.total_cost || 0);
    }
    const list = Object.values(agg).map(r => ({ ...r, cost_usd: +r.cost_usd.toFixed(4), raw: { total_usage: totalUsage, total_credits: totalCredits } }));

    // Fallback: if no per-generation data, store a single TOTAL row for today
    // so the dashboard at least sees account-level spend / remaining credits
    if (!list.length) {
      const today = new Date().toISOString().slice(0, 10);
      list.push({
        day: today,
        vendor: 'openrouter',
        model: '_account_total',
        request_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: +Number(totalUsage || 0).toFixed(4),
        raw: { total_usage: totalUsage, total_credits: totalCredits, note: 'account-level snapshot, no per-gen data available' },
      });
    }

    const { error } = await sb.from('vendor_usage_daily').upsert(list, { onConflict: 'day,vendor,model' });
    if (error) throw error;
    rows = list.length;
    await finishRun(runId, 'ok', rows);
    return { rows, totalUsage, totalCredits };
  } catch (err) {
    await finishRun(runId, 'error', rows, String(err).slice(0, 1000));
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- OpenAI ---------------------------------------------------------
async function syncOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { rows: 0, note: 'OPENAI_API_KEY missing' };
  const runId = await startRun('openai');
  let rows = 0;
  try {
    // OpenAI new Usage API needs Admin Key (sk-admin-...).
    // We try the cost endpoint; if 401/insufficient_permissions, skip gracefully.
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    const startTs = Math.floor(thirtyDaysAgo.getTime() / 1000);

    const r = await fetch(`https://api.openai.com/v1/organization/usage/completions?start_time=${startTs}&bucket_width=1d&limit=31`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`OpenAI usage API ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    const buckets = j?.data || [];

    const agg = {};
    for (const b of buckets) {
      const day = new Date(b.start_time * 1000).toISOString().slice(0, 10);
      for (const res of (b.results || [])) {
        const model = res.model || 'unknown';
        const key = `${day}|${model}`;
        if (!agg[key]) agg[key] = { day, vendor: 'openai', model, request_count: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
        agg[key].request_count += res.num_model_requests || 0;
        agg[key].input_tokens += res.input_tokens || 0;
        agg[key].output_tokens += res.output_tokens || 0;
      }
    }
    // Optional separate cost endpoint
    const cr = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${startTs}&bucket_width=1d&limit=31`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (cr.ok) {
      const cj = await cr.json();
      for (const b of (cj.data || [])) {
        const day = new Date(b.start_time * 1000).toISOString().slice(0, 10);
        for (const res of (b.results || [])) {
          const amt = res.amount?.value || 0;
          // distribute over models for that day
          const keys = Object.keys(agg).filter(k => k.startsWith(day + '|'));
          if (keys.length) {
            const share = amt / keys.length;
            for (const k of keys) agg[k].cost_usd += share;
          } else {
            agg[`${day}|unknown`] = { day, vendor: 'openai', model: 'unknown', request_count: 0, input_tokens: 0, output_tokens: 0, cost_usd: amt };
          }
        }
      }
    }
    const list = Object.values(agg).map(r => ({ ...r, cost_usd: +r.cost_usd.toFixed(4) }));
    if (list.length) {
      const { error } = await sb.from('vendor_usage_daily').upsert(list, { onConflict: 'day,vendor,model' });
      if (error) throw error;
      rows = list.length;
    }
    await finishRun(runId, 'ok', rows);
    return { rows };
  } catch (err) {
    await finishRun(runId, 'error', rows, String(err).slice(0, 1000));
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Anthropic API (admin) -----------------------------------------
async function syncAnthropic() {
  const key = process.env.ANTHROPIC_ADMIN_KEY || null;  // requires admin key (sk-ant-admin-...)
  if (!key) return { rows: 0, note: 'ANTHROPIC_ADMIN_KEY missing (needs sk-ant-admin-... for usage_report)' };
  const runId = await startRun('anthropic');
  let rows = 0;
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);
    const start = thirtyDaysAgo.toISOString();

    const r = await fetch(`https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${encodeURIComponent(start)}&bucket_width=1d`, {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Anthropic usage API ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    const agg = {};
    for (const bucket of (j.data || [])) {
      const day = bucket.starting_at?.slice(0, 10);
      for (const res of (bucket.results || [])) {
        const model = res.model || 'unknown';
        const key = `${day}|${model}`;
        if (!agg[key]) agg[key] = { day, vendor: 'anthropic_api', model, request_count: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
        agg[key].input_tokens += (res.uncached_input_tokens || 0) + (res.cache_read_input_tokens || 0) + (res.cache_creation_input_tokens || 0);
        agg[key].output_tokens += res.output_tokens || 0;
      }
    }
    const list = Object.values(agg);
    if (list.length) {
      const { error } = await sb.from('vendor_usage_daily').upsert(list, { onConflict: 'day,vendor,model' });
      if (error) throw error;
      rows = list.length;
    }
    await finishRun(runId, 'ok', rows);
    return { rows };
  } catch (err) {
    await finishRun(runId, 'error', rows, String(err).slice(0, 1000));
    return { rows, error: String(err).slice(0, 200) };
  }
}

(async () => {
  console.log('--- Vendor Sync ---');
  const or = await syncOpenRouter();   console.log('OpenRouter:', or);
  const oa = await syncOpenAI();        console.log('OpenAI:    ', oa);
  const an = await syncAnthropic();     console.log('Anthropic: ', an);
})();
