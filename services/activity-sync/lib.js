/**
 * Shared lib for all vendor-sync modules:
 *  - env loader
 *  - supabase client
 *  - sync-run lifecycle
 *  - missing-key noter
 *  - generic metric upsert
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
async function finishRun(id, status, rows = 0, err = null) {
  if (!id) return;
  await sb.from('activity_sync_runs').update({
    status, rows_processed: rows, finished_at: new Date().toISOString(), error: err ? String(err).slice(0, 1000) : null,
  }).eq('id', id);
}

async function noteMissingKey(vendor, key, scope, reason, console_url) {
  await sb.from('missing_api_keys').upsert({
    vendor, needed_key: key, needed_scope: scope, reason, console_url, status: 'pending',
  }, { onConflict: 'vendor,needed_key' });
}

async function resolveMissingKey(vendor, key) {
  await sb.from('missing_api_keys').update({
    status: 'resolved', resolved_at: new Date().toISOString(),
  }).eq('vendor', vendor).eq('needed_key', key);
}

async function upsertMetrics(rows) {
  if (!rows.length) return 0;
  const CHUNK = 200;
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await sb.from('vendor_metrics_daily').upsert(slice, { onConflict: 'day,vendor,metric_name,scope' });
    if (error) throw error;
    n += slice.length;
  }
  return n;
}

async function fetchJson(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { _raw: text }; }
    return { ok: r.ok, status: r.status, body };
  } finally { clearTimeout(tm); }
}

const TODAY = () => new Date().toISOString().slice(0, 10);

module.exports = { sb, startRun, finishRun, noteMissingKey, resolveMissingKey, upsertMetrics, fetchJson, TODAY };
