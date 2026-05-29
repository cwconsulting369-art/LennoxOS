#!/usr/bin/env node
/**
 * Stripe Subscriptions + Payments Sync (Carlos's eigene Abos)
 *
 * Uses STRIPE_SECRET_KEY. Pulls:
 *   - All active+past subscriptions → stripe_subscriptions
 *   - Last 100 payments (charges + invoices) → stripe_payments
 *
 * NOTE: This is Carlos's OWN Stripe-account (for outgoing payments he RECEIVES,
 * not for subscriptions he PAYS to others). For tools he PAYS for (Vercel, CF, etc.)
 * data must be manually added via the subscriptions table (see project-subscription-tracking memory).
 * This sync gives the FROM-customers view; the TO-vendors view is a separate manual table.
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

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY missing');
  process.exit(1);
}
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-09-30.acacia' });

async function startRun() {
  const { data } = await sb.from('activity_sync_runs').insert({ source: 'stripe', status: 'running' }).select('id').single();
  return data?.id;
}
async function finishRun(id, status, rows, err) {
  if (!id) return;
  await sb.from('activity_sync_runs').update({
    status, rows_processed: rows, finished_at: new Date().toISOString(), error: err || null,
  }).eq('id', id);
}

(async () => {
  const runId = await startRun();
  let total = 0;
  try {
    // ---------- Subscriptions --------------------------------------
    const subs = [];
    let starting_after = null;
    for (let p = 0; p < 10; p++) {
      const r = await stripe.subscriptions.list({
        limit: 100, status: 'all',
        ...(starting_after ? { starting_after } : {}),
        expand: ['data.items.data.price'],
      });
      subs.push(...r.data);
      if (!r.has_more) break;
      starting_after = r.data[r.data.length - 1].id;
    }
    const subRows = subs.map(s => {
      const item = s.items?.data?.[0];
      const price = item?.price;
      const product = price?.product;
      return {
        stripe_id: s.id,
        customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id,
        product_name: product?.name || price?.nickname || null,
        price_nickname: price?.nickname || null,
        amount_cents: price?.unit_amount || 0,
        currency: (price?.currency || 'eur').toLowerCase(),
        interval: price?.recurring?.interval || null,
        status: s.status,
        current_period_start: s.current_period_start ? new Date(s.current_period_start * 1000).toISOString() : null,
        current_period_end:   s.current_period_end   ? new Date(s.current_period_end   * 1000).toISOString() : null,
        cancel_at_period_end: !!s.cancel_at_period_end,
        raw: s,
      };
    });
    if (subRows.length) {
      const { error } = await sb.from('stripe_subscriptions').upsert(subRows, { onConflict: 'stripe_id' });
      if (error) throw error;
      total += subRows.length;
    }
    console.log(`Synced ${subRows.length} subscriptions`);

    // ---------- Payments (Charges) --------------------------------
    const charges = [];
    let cs = null;
    for (let p = 0; p < 5; p++) {
      const r = await stripe.charges.list({ limit: 100, ...(cs ? { starting_after: cs } : {}) });
      charges.push(...r.data);
      if (!r.has_more) break;
      cs = r.data[r.data.length - 1].id;
    }
    const payRows = charges.map(c => ({
      stripe_id: c.id,
      amount_cents: c.amount,
      currency: c.currency,
      status: c.status,
      description: c.description || c.statement_descriptor || null,
      created_at: new Date(c.created * 1000).toISOString(),
      subscription_id: c.invoice && typeof c.invoice === 'object' ? c.invoice.subscription : null,
      raw: c,
    }));
    if (payRows.length) {
      const { error } = await sb.from('stripe_payments').upsert(payRows, { onConflict: 'stripe_id' });
      if (error) throw error;
      total += payRows.length;
    }
    console.log(`Synced ${payRows.length} payments`);

    await finishRun(runId, 'ok', total);
  } catch (err) {
    console.error('ERROR:', err.message);
    await finishRun(runId, 'error', total, String(err).slice(0, 1000));
    process.exit(1);
  }
})();
