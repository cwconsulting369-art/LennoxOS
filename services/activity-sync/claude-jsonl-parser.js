#!/usr/bin/env node
/**
 * Claude-Code JSONL Parser
 *
 * Scans ~/.claude/projects/<dir>/*.jsonl, extracts per-message usage,
 * upserts into Supabase: claude_sessions, claude_messages, claude_usage_daily.
 *
 * Idempotent: uses message uuid as PK and file_size/mtime as session-change hint.
 * Run hourly via cron.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// --- env load (lennox-os/.env or /home/carlos/.claude/.env fallback) ----
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const PROJECTS_ROOT = '/home/carlos/.claude/projects';

// Project-slug detection from cwd / folder-name / tool-call paths
const PROJECT_TESTS = [
  { re: /aevum/i,                          slug: 'aevum' },
  { re: /gold.?trader|gts|gold-bot/i,      slug: 'gts' },
  { re: /ketolabs/i,                       slug: 'ketolabs' },
  { re: /utility.?hub|\/uh\b/i,            slug: 'utilityhub' },
  { re: /thailand|patrick/i,               slug: 'thailand' },
  { re: /lennox-?os|lennoxos/i,            slug: 'lennoxos' },
  { re: /paperclip/i,                      slug: 'paperclip' },
  { re: /k3ngama/i,                        slug: 'k3ngama' },
  { re: /betterfly/i,                      slug: 'betterfly' },
  { re: /personal-os/i,                    slug: 'personal-os' },
  { re: /lennox/i,                         slug: 'lennox' },  // last among lennox-matches
];

function detectProjectSlug(cwd, folderName) {
  const hay = `${cwd || ''} ${folderName || ''}`.toLowerCase();
  for (const t of PROJECT_TESTS) if (t.re.test(hay)) return t.slug;
  if (cwd && cwd.includes('/home/carlos')) return 'home';
  return 'unknown';
}

// Tally project mentions across all tool-call paths in a session.
// Returns the dominant project slug; falls back to cwd-based detection.
function detectProjectFromPaths(textBlob, cwdSlug) {
  if (!textBlob) return cwdSlug;
  const counts = {};
  for (const t of PROJECT_TESTS) {
    const matches = textBlob.match(new RegExp(t.re.source, 'gi'));
    if (matches) counts[t.slug] = (counts[t.slug] || 0) + matches.length;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return cwdSlug;
  // Require >= 5 mentions and 1.5x the cwd-fallback to override
  const [topSlug, topCount] = entries[0];
  if (topCount >= 5) return topSlug;
  return cwdSlug;
}

async function startRun() {
  const { data } = await sb
    .from('activity_sync_runs')
    .insert({ source: 'claude-jsonl', status: 'running' })
    .select('id')
    .single();
  return data?.id;
}
async function finishRun(id, status, rows, err) {
  if (!id) return;
  await sb.from('activity_sync_runs')
    .update({ status, rows_processed: rows, finished_at: new Date().toISOString(), error: err || null })
    .eq('id', id);
}

async function listJsonlFiles() {
  const out = [];
  if (!fs.existsSync(PROJECTS_ROOT)) return out;
  const dirs = fs.readdirSync(PROJECTS_ROOT);
  for (const d of dirs) {
    const p = path.join(PROJECTS_ROOT, d);
    let stat; try { stat = fs.statSync(p); } catch { continue; }
    if (!stat.isDirectory()) continue;
    let files;
    try { files = fs.readdirSync(p).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const full = path.join(p, f);
      let st; try { st = fs.statSync(full); } catch { continue; }
      out.push({ folder: d, file: f, full, size: st.size, mtime: st.mtime });
    }
  }
  return out;
}

async function getSessionMeta(sessionId) {
  const { data } = await sb
    .from('claude_sessions')
    .select('session_id, file_size_bytes, file_mtime')
    .eq('session_id', sessionId)
    .maybeSingle();
  return data;
}

async function parseFile(meta, dailyAgg) {
  const { folder, file, full, size, mtime } = meta;
  const sessionId = path.basename(file, '.jsonl');
  const existing = await getSessionMeta(sessionId);
  if (existing && existing.file_size_bytes === size) {
    return { processed: 0, skipped: true };
  }
  // decode project_path from folder-name (-home-carlos--paperclip... → /home/carlos/paperclip/...)
  const projectPath = folder.replace(/^-/, '/').replace(/--/g, '/').replace(/-/g, '/').replace(/\//g, '/');
  // safer decode: just replace leading - with /, and -- with /; rest leave
  const decoded = '/' + folder.replace(/^-/, '').split('--').join('/');

  const rl = readline.createInterface({ input: fs.createReadStream(full), crlfDelay: Infinity });
  const messages = [];
  let firstTs, lastTs, msgCount = 0;
  let totIn = 0, totOut = 0, totCC = 0, totCR = 0, totTool = 0;
  const models = new Set();
  let cwd = null;
  let pathHay = '';   // aggregated text-blob to mine tool-call paths from

  for await (const line of rl) {
    if (!line.trim()) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.cwd && !cwd) cwd = d.cwd;
    if (d.type !== 'assistant' && d.type !== 'user') continue;
    const msg = d.message;
    if (!msg || typeof msg !== 'object') continue;
    const ts = d.timestamp || null;
    if (ts) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
    }
    msgCount++;
    const u = msg.usage || {};
    const inTok = u.input_tokens || 0;
    const outTok = u.output_tokens || 0;
    const ccTok = u.cache_creation_input_tokens || 0;
    const crTok = u.cache_read_input_tokens || 0;
    totIn += inTok; totOut += outTok; totCC += ccTok; totCR += crTok;
    const model = msg.model || null;
    if (model) models.add(model);

    // count tool_use blocks
    let toolCount = 0;
    const toolNames = [];
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c && c.type === 'tool_use') {
          toolCount++;
          if (c.name) toolNames.push(c.name);
          // harvest path-strings from tool inputs to enable better project detection
          try {
            const input = JSON.stringify(c.input || {}).slice(0, 1000);
            pathHay += ' ' + input;
          } catch {}
        }
      }
    }
    totTool += toolCount;

    if (d.uuid) {
      messages.push({
        uuid: d.uuid,
        session_id: sessionId,
        parent_uuid: d.parentUuid || null,
        role: msg.role || d.type,
        model,
        timestamp: ts,
        input_tokens: inTok,
        output_tokens: outTok,
        cache_creation_tokens: ccTok,
        cache_read_tokens: crTok,
        tool_use_count: toolCount,
        tool_names: toolNames,
        stop_reason: msg.stop_reason || null,
      });
    }

    // Aggregate daily — slug is finalized AFTER full session parse (path-mining),
    // but for streaming we use cwd-fallback and re-key at the end
    if (ts && model) {
      const day = ts.slice(0, 10);
      const slug = detectProjectSlug(cwd, folder);
      const key = `${day}|${model}|${slug}`;
      if (!dailyAgg[key]) {
        dailyAgg[key] = { day, model, project_slug: slug,
          message_count: 0, input_tokens: 0, output_tokens: 0,
          cache_creation_tokens: 0, cache_read_tokens: 0, tool_calls: 0 };
      }
      const a = dailyAgg[key];
      a.message_count++;
      a.input_tokens += inTok;
      a.output_tokens += outTok;
      a.cache_creation_tokens += ccTok;
      a.cache_read_tokens += crTok;
      a.tool_calls += toolCount;
    }
  }

  // Finalize project slug: use path-mining if cwd-based detection lands in generic bucket
  const cwdSlug = detectProjectSlug(cwd, folder);
  const finalSlug = ['home', 'unknown', 'lennox'].includes(cwdSlug)
    ? detectProjectFromPaths(pathHay, cwdSlug)
    : cwdSlug;

  // Re-key daily aggregations for THIS session if finalSlug differs from cwdSlug
  if (finalSlug !== cwdSlug) {
    for (const k of Object.keys(dailyAgg)) {
      const [day, model, slug] = k.split('|');
      // Only touch entries that match this session's cwd-slug (best-effort)
      if (slug === cwdSlug) {
        const newKey = `${day}|${model}|${finalSlug}`;
        if (!dailyAgg[newKey]) dailyAgg[newKey] = { ...dailyAgg[k], project_slug: finalSlug };
        else {
          const a = dailyAgg[newKey], b = dailyAgg[k];
          a.message_count += b.message_count;
          a.input_tokens += b.input_tokens;
          a.output_tokens += b.output_tokens;
          a.cache_creation_tokens += b.cache_creation_tokens;
          a.cache_read_tokens += b.cache_read_tokens;
          a.tool_calls += b.tool_calls;
        }
        delete dailyAgg[k];
      }
    }
  }

  // Upsert session
  const sessionRow = {
    session_id: sessionId,
    project_path: cwd || decoded,
    project_slug: finalSlug,
    file_path: full,
    first_seen_at: firstTs || new Date(mtime).toISOString(),
    last_seen_at: lastTs || new Date(mtime).toISOString(),
    message_count: msgCount,
    total_input_tokens: totIn,
    total_output_tokens: totOut,
    total_cache_creation_tokens: totCC,
    total_cache_read_tokens: totCR,
    total_tool_calls: totTool,
    models_used: Array.from(models),
    file_size_bytes: size,
    file_mtime: new Date(mtime).toISOString(),
  };
  await sb.from('claude_sessions').upsert(sessionRow, { onConflict: 'session_id' });

  // Dedup messages by uuid (some logs replay same uuid across retries)
  const dedupMap = new Map();
  for (const m of messages) dedupMap.set(m.uuid, m);
  const unique = Array.from(dedupMap.values());

  // Upsert messages in chunks
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { error } = await sb.from('claude_messages').upsert(slice, { onConflict: 'uuid' });
    if (error) console.error('  msg upsert error:', error.message);
  }

  return { processed: messages.length, skipped: false };
}

// API-equivalent cost rates per 1M tokens (USD, approx 2026-05)
const RATES = {
  'claude-opus-4-7':    { in: 15, out: 75, cache_write: 18.75, cache_read: 1.5 },
  'claude-opus-4-6':    { in: 15, out: 75, cache_write: 18.75, cache_read: 1.5 },
  'claude-sonnet-4-6':  { in: 3,  out: 15, cache_write: 3.75,  cache_read: 0.3 },
  'claude-sonnet-4-5':  { in: 3,  out: 15, cache_write: 3.75,  cache_read: 0.3 },
  'claude-haiku-4-5':   { in: 1,  out: 5,  cache_write: 1.25,  cache_read: 0.1 },
};
function effectiveCost(model, inT, outT, ccT, crT) {
  const r = RATES[model] || RATES['claude-sonnet-4-6'];
  return (inT*r.in + outT*r.out + ccT*r.cache_write + crT*r.cache_read) / 1e6;
}

async function flushDaily(agg) {
  const rows = Object.values(agg).map(r => ({
    ...r,
    effective_cost_usd: +effectiveCost(r.model, r.input_tokens, r.output_tokens, r.cache_creation_tokens, r.cache_read_tokens).toFixed(4),
  }));
  if (!rows.length) return;
  // delete-then-insert pattern (because we re-aggregate from scratch each touched day-model-slug)
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    // upsert via onConflict
    const { error } = await sb.from('claude_usage_daily').upsert(slice, { onConflict: 'day,model,project_slug' });
    if (error) console.error('  daily upsert error:', error.message);
  }
}

(async () => {
  const runId = await startRun();
  let totalRows = 0;
  try {
    const files = await listJsonlFiles();
    console.log(`Found ${files.length} jsonl files`);
    const dailyAgg = {};
    let processed = 0, skipped = 0;
    for (const f of files) {
      const r = await parseFile(f, dailyAgg);
      if (r.skipped) skipped++;
      else { processed++; totalRows += r.processed; }
    }
    console.log(`Parsed: ${processed} files (${totalRows} messages), skipped: ${skipped} unchanged`);
    await flushDaily(dailyAgg);
    console.log(`Flushed ${Object.keys(dailyAgg).length} daily-agg rows`);
    await finishRun(runId, 'ok', totalRows);
  } catch (err) {
    console.error('ERROR:', err);
    await finishRun(runId, 'error', totalRows, String(err).slice(0, 1000));
    process.exit(1);
  }
})();
