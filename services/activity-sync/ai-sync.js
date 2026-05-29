#!/usr/bin/env node
/**
 * AI Vendor Sync — Gemini + Perplexity + ElevenLabs + HuggingFace
 *
 * Most consumer-grade AI keys don't expose detailed usage APIs.
 * We probe what's possible and note missing endpoints.
 */
const { startRun, finishRun, noteMissingKey, resolveMissingKey, upsertMetrics, fetchJson, TODAY } = require('./lib');

// ---------- Gemini ---------------------------------------------------------
async function syncGemini() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    await noteMissingKey('gemini', 'GEMINI_API_KEY', 'read', 'Model listing + ping (AI Studio has no usage API per-key)', 'https://aistudio.google.com/app/apikey');
    return { rows: 0, note: 'GEMINI_API_KEY missing' };
  }
  const runId = await startRun('gemini');
  let rows = 0;
  try {
    // No public usage endpoint for Gemini Studio keys; can only verify key works
    const m = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (!m.ok) throw new Error(`models endpoint: ${m.status}`);
    const modelCount = (m.body?.models || []).length;

    rows = await upsertMetrics([
      { day: TODAY(), vendor: 'gemini', metric_name: 'available_models', scope: '', value: modelCount, unit: 'count' },
      { day: TODAY(), vendor: 'gemini', metric_name: 'key_status',       scope: '', value: 1, unit: 'state' },
    ]);
    await noteMissingKey('gemini', 'GEMINI_USAGE_API', 'usage', 'AI Studio keys haben KEINE per-key usage API. Nur via Cloud Console + Service Account.', 'https://console.cloud.google.com/apis/dashboard');
    await finishRun(runId, 'ok', rows);
    return { rows, models: modelCount };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Perplexity -----------------------------------------------------
async function syncPerplexity() {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    await noteMissingKey('perplexity', 'PERPLEXITY_API_KEY', 'read', 'Account credits + request history', 'https://www.perplexity.ai/settings/api');
    return { rows: 0, note: 'PERPLEXITY_API_KEY missing' };
  }
  const runId = await startRun('perplexity');
  let rows = 0;
  try {
    // Perplexity has NO documented usage API; probe what exists
    // Try /chat/completions with a tiny request to verify key works (sanity check, costs ~$0.0001)
    // Better: just register key status + note missing usage endpoint
    await noteMissingKey('perplexity', 'PERPLEXITY_USAGE_API', 'usage', 'Perplexity API hat KEIN public usage-endpoint (Stand 2026-05). Tracking nur via Anthropic-style proxy oder dashboard.', 'https://www.perplexity.ai/settings/api');
    rows = await upsertMetrics([
      { day: TODAY(), vendor: 'perplexity', metric_name: 'key_status', scope: '', value: 1, unit: 'state' },
    ]);
    await finishRun(runId, 'ok', rows);
    return { rows, note: 'no usage API; key registered' };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- ElevenLabs ----------------------------------------------------
async function syncElevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    await noteMissingKey('elevenlabs', 'ELEVENLABS_API_KEY', 'read', 'Character usage + subscription tier', 'https://elevenlabs.io/app/settings/api-keys');
    return { rows: 0, note: 'ELEVENLABS_API_KEY missing' };
  }
  const runId = await startRun('elevenlabs');
  let rows = 0;
  try {
    const auth = { headers: { 'xi-api-key': key } };
    const sub = await fetchJson('https://api.elevenlabs.io/v1/user/subscription', auth);
    if (!sub.ok) throw new Error(`subscription: ${sub.status}`);
    const s = sub.body || {};
    const usage = await fetchJson('https://api.elevenlabs.io/v1/user', auth);

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'elevenlabs', metric_name: 'character_count',     scope: '', value: s.character_count || 0, unit: 'characters' },
      { day: today, vendor: 'elevenlabs', metric_name: 'character_limit',     scope: '', value: s.character_limit || 0, unit: 'characters' },
      { day: today, vendor: 'elevenlabs', metric_name: 'character_remaining', scope: '', value: Math.max(0, (s.character_limit || 0) - (s.character_count || 0)), unit: 'characters' },
      { day: today, vendor: 'elevenlabs', metric_name: 'tier',                scope: '', value: 1, unit: 'state', raw: { tier: s.tier, status: s.status } },
    ];
    rows = await upsertMetrics(metrics);
    await resolveMissingKey('elevenlabs', 'ELEVENLABS_API_KEY');
    await finishRun(runId, 'ok', rows);
    return { rows, tier: s.tier, used: s.character_count, limit: s.character_limit };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- HuggingFace ---------------------------------------------------
async function syncHuggingFace() {
  const key = process.env.HUGGINGFACE_TOKEN;
  if (!key) {
    await noteMissingKey('huggingface', 'HUGGINGFACE_TOKEN', 'read', 'Account info + inference usage', 'https://huggingface.co/settings/tokens');
    return { rows: 0, note: 'HUGGINGFACE_TOKEN missing' };
  }
  const runId = await startRun('huggingface');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${key}` } };
    const whoami = await fetchJson('https://huggingface.co/api/whoami-v2', auth);
    if (!whoami.ok) throw new Error(`whoami: ${whoami.status}`);

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'huggingface', metric_name: 'key_status', scope: '', value: 1, unit: 'state', raw: { type: whoami.body?.type, name: whoami.body?.name } },
    ];
    // HF doesn't expose per-key usage in public API
    await noteMissingKey('huggingface', 'HUGGINGFACE_USAGE_API', 'usage', 'HF hat KEIN per-token usage-API (Stand 2026-05). Nur Inference-Endpoints sind metered intern.', 'https://huggingface.co/settings/billing');
    rows = await upsertMetrics(metrics);
    await finishRun(runId, 'ok', rows);
    return { rows, user: whoami.body?.name };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

(async () => {
  console.log('--- AI Vendor Sync ---');
  console.log('Gemini:      ', await syncGemini());
  console.log('Perplexity:  ', await syncPerplexity());
  console.log('ElevenLabs:  ', await syncElevenLabs());
  console.log('HuggingFace: ', await syncHuggingFace());
})();
