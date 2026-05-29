#!/usr/bin/env node
/**
 * Seed subscriptions table from personal-os/05-finance/expenses.md + manual additions.
 * Idempotent: uses (vendor, product_name, plan, amount_cents) as natural-key.
 */
const fs = require('fs');
const { sb } = require('./lib');

// Parse EUR/USD amounts ("€90,00", "**€90,00**", "**~€23,00** (~$25)")
function parseAmount(s) {
  if (!s) return { cents: 0, currency: 'eur' };
  const cleaned = s.replace(/[\*~]/g, '').trim();
  // Pick first €XX,XX or €XX
  const m = cleaned.match(/€\s*([\d.,]+)/);
  if (m) {
    const n = parseFloat(m[1].replace('.', '').replace(',', '.'));
    return { cents: Math.round(n * 100), currency: 'eur' };
  }
  const um = cleaned.match(/\$\s*([\d.,]+)/);
  if (um) {
    const n = parseFloat(um[1].replace(',', '.'));
    return { cents: Math.round(n * 100), currency: 'usd' };
  }
  return { cents: 0, currency: 'eur' };
}

// Vendor-name → category guess
function categoryFor(vendor) {
  const v = vendor.toLowerCase();
  if (/vercel|cloudflare|hetzner|github|supabase/.test(v)) return 'infra';
  if (/claude|anthropic|openai|gemini|perplexity|elevenlabs|hugging/.test(v)) return 'ai';
  if (/n8n|make|zapier/.test(v)) return 'automation';
  if (/klaviyo|hubspot|brevo|airtable/.test(v)) return 'marketing';
  if (/notion|obsidian|raycast|1password/.test(v)) return 'dev';
  return 'dev';
}

async function upsertSub(s) {
  const { error } = await sb.from('subscriptions').upsert({
    vendor: s.vendor,
    product_name: s.product_name,
    plan: s.plan || null,
    amount_cents: s.amount_cents || 0,
    currency: s.currency || 'eur',
    interval: s.interval || 'month',
    status: s.status || 'active',
    account_source: s.account_source || 'cwconsulting369',
    source: s.source || 'md_seed',
    category: s.category || categoryFor(s.vendor),
    vendor_url: s.vendor_url || null,
    notes: s.notes || null,
    raw: s.raw || null,
    next_renewal_at: s.next_renewal_at || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'vendor,product_name,plan,amount_cents' });
  if (error) throw error;
}

async function seedFromMd() {
  const expPath = '/home/carlos/personal-os/05-finance/expenses.md';
  if (!fs.existsSync(expPath)) return 0;
  const content = fs.readFileSync(expPath, 'utf8');
  const lines = content.split('\n');
  let count = 0;
  let inTable = false;
  for (const line of lines) {
    if (line.includes('| Tool')) { inTable = true; continue; }
    if (inTable && line.startsWith('|') && !line.includes('---')) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3 && !parts[0].includes('Tool')) {
        const name = parts[0].replace(/~~|\/\//g, '').trim().replace(/^~~(.+)~~$/, '$1');
        const plan = parts[1] || '';
        const costStr = parts[2] || '';
        const renewal = parts[3] || '';
        const status = parts[4] || '';
        const active = !status.toLowerCase().includes('gekündigt') && !parts[0].startsWith('~~');
        const { cents, currency } = parseAmount(costStr);

        // derive vendor from name
        const vendor = name.split(/[\s(]/)[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
        const interval = renewal.includes('jährl') || renewal.includes('Yearly') || renewal.includes('April') ? 'year' : 'month';
        await upsertSub({
          vendor,
          product_name: name,
          plan,
          amount_cents: cents,
          currency,
          interval,
          status: active ? 'active' : 'cancelled',
          source: 'md_seed',
          notes: renewal ? `Renewal: ${renewal}` : null,
        });
        count++;
      }
    }
    if (inTable && !line.startsWith('|') && line.trim()) inTable = false;
  }
  return count;
}

// Hardcoded additions from intel we already have (Activity-Dashboard, AEVUM, etc.)
async function seedFromKnownState() {
  const known = [
    { vendor: 'hetzner',    product_name: 'Hetzner Cloud (LennoxOS)', plan: 'CX22 detected', amount_cents: 1962, currency: 'eur', notes: 'Auto-detected via infra-sync — 1 server' },
    { vendor: 'cloudflare', product_name: 'Cloudflare', plan: 'Free (6 zones)', amount_cents: 0, currency: 'eur', notes: 'Free Plan — kein recurring cost' },
    { vendor: 'openrouter', product_name: 'OpenRouter Credits', plan: 'Pay-as-you-go', amount_cents: 0, currency: 'usd', interval: 'usage', notes: 'Account-Balance ~$178/$238 (Stand 2026-05-24)' },
    { vendor: 'elevenlabs', product_name: 'ElevenLabs Creator', plan: 'Creator', amount_cents: 2200, currency: 'usd', notes: 'tier=creator, 236k chars/mo (~$22)' },
    { vendor: 'gemini',     product_name: 'Google AI Studio (Gemini)', plan: 'Free Tier', amount_cents: 0, currency: 'eur', notes: 'Free, 50 models' },
    { vendor: 'huggingface', product_name: 'HuggingFace', plan: 'Free', amount_cents: 0, currency: 'eur', notes: 'Free account @Iamcarlostheone' },
    { vendor: 'github',     product_name: 'GitHub', plan: 'Free', amount_cents: 0, currency: 'usd', notes: '6 repos @cwconsulting369-art' },
  ];
  for (const k of known) await upsertSub({ ...k, source: 'intel_seed' });
  return known.length;
}

(async () => {
  console.log('--- Seed subscriptions ---');
  const md = await seedFromMd();
  console.log(`md_seed: ${md} subs from expenses.md`);
  const known = await seedFromKnownState();
  console.log(`intel_seed: ${known} subs from known state`);
  const { count } = await sb.from('subscriptions').select('id', { count: 'exact', head: true });
  console.log(`Total subscriptions in DB: ${count}`);
})();
