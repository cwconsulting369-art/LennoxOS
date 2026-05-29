#!/usr/bin/env node
/**
 * Email-Receipt-Scanner — both Gmail accounts → 12 months back
 *
 * Strategy:
 *  1. Scan both Gmail accounts (GOOGLE_REFRESH_TOKEN + GOOGLE_REFRESH_TOKEN_2) for
 *     receipt-like messages (from:noreply OR subject contains receipt/invoice/subscription/charge/payment/abrechnung/rechnung)
 *  2. For each hit, extract subject + from + body text
 *  3. Use Gemini Flash to extract structured: { vendor, product_name, plan, amount, currency, interval, charge_date }
 *  4. Upsert into subscriptions
 */
const { sb } = require('./lib');

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY missing'); process.exit(1); }

async function getAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Token-refresh failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function gmailSearch(token, query, maxResults = 100) {
  const out = [];
  let pageToken = null;
  for (let i = 0; i < 5; i++) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', maxResults);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.messages) out.push(...j.messages);
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

async function getMessage(token, id) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.json();
}

function decodeB64Url(s) {
  if (!s) return '';
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(std, 'base64').toString('utf8');
}

function extractText(payload) {
  if (!payload) return '';
  let out = '';
  if (payload.body?.data) {
    if (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html') {
      out += decodeB64Url(payload.body.data);
    }
  }
  for (const part of (payload.parts || [])) {
    out += '\n' + extractText(part);
  }
  return out;
}

function stripHtml(s) {
  return (s || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EXTRACT_PROMPT = `Du analysierst Email-Receipts/Invoices. Extrahiere strukturierte Sub-Daten als JSON.

REGELN:
- Wenn die Email KEINE echte Zahlung/Receipt/Invoice ist (z.B. nur Newsletter, Trial-Reminder, App-Update, Werbung), antworte: {"is_receipt": false}
- Wenn es ein Receipt ist, antworte mit:
  {"is_receipt": true, "vendor": "<saubere Vendor-Marke, z.B. 'Vercel', 'Anthropic', 'Hetzner'>",
   "product_name": "<vollständiger Produkt-Name>",
   "plan": "<Tier/Plan oder null>",
   "amount": <Zahl, KEIN String>,
   "currency": "<EUR|USD|...>",
   "interval": "month|year|usage|one_time",
   "charge_date": "<YYYY-MM-DD oder null>"}
- KEIN Markdown, NUR pures JSON, KEINE Code-Blocks.

EMAIL:
SUBJECT: {{subject}}
FROM: {{from}}
DATE: {{date}}
BODY: {{body}}`;

async function callGemini(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400, responseMimeType: 'application/json' },
    }),
  });
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function categoryFor(vendor) {
  const v = (vendor || '').toLowerCase();
  if (/vercel|cloudflare|hetzner|github|supabase|aws|netlify|render/.test(v)) return 'infra';
  if (/claude|anthropic|openai|gemini|perplexity|elevenlabs|hugging|replicate|cohere/.test(v)) return 'ai';
  if (/n8n|make|zapier/.test(v)) return 'automation';
  if (/klaviyo|hubspot|brevo|airtable|mailchimp/.test(v)) return 'marketing';
  if (/notion|obsidian|raycast|1password|linear|figma/.test(v)) return 'dev';
  if (/apple|google\s?one|spotify|netflix|amazon\s?prime|youtube|disney/.test(v)) return 'personal';
  return 'dev';
}

async function scanAccount(accountName, refreshToken, since) {
  console.log(`\n=== Scanning ${accountName} (since ${since}) ===`);
  const runResp = await sb.from('email_scan_runs').insert({
    account: accountName, range_days: 365, status: 'running',
  }).select('id').single();
  const runId = runResp.data?.id;

  let messagesScanned = 0, receiptsExtracted = 0, subsUpserted = 0;
  try {
    const token = await getAccessToken(refreshToken);

    // Multi-query search to catch German + English receipt patterns
    const queries = [
      `after:${since.replace(/-/g, '/')} (subject:receipt OR subject:invoice OR subject:rechnung OR subject:abrechnung OR subject:billing OR subject:payment OR subject:zahlung OR subject:thanks OR subject:order OR subject:bestätigung OR subject:subscription OR subject:abo)`,
      `after:${since.replace(/-/g, '/')} (from:billing OR from:invoice OR from:noreply OR from:no-reply OR from:receipts OR from:notifications OR from:stripe)`,
    ];

    const idSet = new Set();
    for (const q of queries) {
      const msgs = await gmailSearch(token, q, 100);
      for (const m of msgs) idSet.add(m.id);
    }
    const ids = Array.from(idSet);
    console.log(`  ${ids.length} candidate messages`);

    // Batch process — 5 concurrent
    const CONCURRENCY = 5;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (id) => {
        try {
          const msg = await getMessage(token, id);
          messagesScanned++;
          const headers = {};
          (msg.payload?.headers || []).forEach(h => headers[h.name] = h.value);
          const body = stripHtml(extractText(msg.payload)).slice(0, 3500);
          if (body.length < 50) return;

          const prompt = EXTRACT_PROMPT
            .replace('{{subject}}', headers['Subject'] || '')
            .replace('{{from}}', headers['From'] || '')
            .replace('{{date}}', headers['Date'] || '')
            .replace('{{body}}', body);

          const parsed = await callGemini(prompt);
          if (!parsed || !parsed.is_receipt) return;
          receiptsExtracted++;

          if (!parsed.vendor || !parsed.amount) return;
          const cents = Math.round(parseFloat(parsed.amount) * 100);
          if (cents <= 0) return;

          const vendor = String(parsed.vendor).toLowerCase().replace(/\s+/g, '');
          const { error } = await sb.from('subscriptions').upsert({
            vendor,
            product_name: parsed.product_name || parsed.vendor,
            plan: parsed.plan || null,
            amount_cents: cents,
            currency: (parsed.currency || 'eur').toLowerCase(),
            interval: parsed.interval || 'month',
            status: 'active',
            account_source: accountName,
            source: 'email_scan',
            category: categoryFor(vendor),
            last_charged_at: parsed.charge_date ? new Date(parsed.charge_date).toISOString() : null,
            raw: { subject: headers['Subject'], from: headers['From'], message_id: id, extracted: parsed },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'vendor,product_name,plan,amount_cents' });
          if (!error) subsUpserted++;
        } catch (e) {
          // silently skip individual failures
        }
      }));
      // progress every 25
      if ((i + CONCURRENCY) % 25 === 0 || i + CONCURRENCY >= ids.length) {
        process.stdout.write(`  progress: ${Math.min(i + CONCURRENCY, ids.length)}/${ids.length} (receipts: ${receiptsExtracted}, upserts: ${subsUpserted})\n`);
      }
    }

    await sb.from('email_scan_runs').update({
      messages_scanned: messagesScanned,
      receipts_extracted: receiptsExtracted,
      subs_upserted: subsUpserted,
      status: 'ok',
    }).eq('id', runId);

    return { account: accountName, ids: ids.length, messagesScanned, receiptsExtracted, subsUpserted };
  } catch (err) {
    await sb.from('email_scan_runs').update({
      status: 'error', error: String(err).slice(0, 1000),
      messages_scanned: messagesScanned, receipts_extracted: receiptsExtracted, subs_upserted: subsUpserted,
    }).eq('id', runId);
    console.error('  ERROR:', err.message);
    return { account: accountName, error: err.message };
  }
}

(async () => {
  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const accounts = [
    { name: 'cwconsulting369', refresh: process.env.GOOGLE_REFRESH_TOKEN },
    { name: 'carloswrusch97',  refresh: process.env.GOOGLE_REFRESH_TOKEN_2 },
  ];
  for (const acc of accounts) {
    if (!acc.refresh) {
      console.log(`Skip ${acc.name}: no refresh-token`);
      continue;
    }
    const res = await scanAccount(acc.name, acc.refresh, since);
    console.log('Result:', res);
  }
})();
