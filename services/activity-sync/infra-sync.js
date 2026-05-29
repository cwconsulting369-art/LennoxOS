#!/usr/bin/env node
/**
 * Infra Sync — Vercel + Cloudflare + Hetzner
 * Tracks: deployments, projects, bandwidth, requests, server-status, server-cost.
 */
const { startRun, finishRun, noteMissingKey, resolveMissingKey, upsertMetrics, fetchJson, TODAY } = require('./lib');

// ---------- Vercel ---------------------------------------------------------
async function syncVercel() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    await noteMissingKey('vercel', 'VERCEL_TOKEN', 'read', 'Account/Deployment data', 'https://vercel.com/account/tokens');
    return { rows: 0, note: 'VERCEL_TOKEN missing' };
  }
  const runId = await startRun('vercel');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // 1) List projects (counts)
    const proj = await fetchJson('https://api.vercel.com/v9/projects?limit=100', auth);
    const projectCount = (proj.body?.projects || []).length;

    // 2) List recent deployments (last 100)
    const dep = await fetchJson('https://api.vercel.com/v6/deployments?limit=100', auth);
    const deps = dep.body?.deployments || [];

    // Aggregate deployments per day per project
    const dayProj = {};
    for (const d of deps) {
      const day = (new Date(d.created)).toISOString().slice(0, 10);
      const proj = d.name || d.meta?.githubRepo || 'unknown';
      const k = `${day}|${proj}`;
      dayProj[k] = dayProj[k] || { day, scope: proj, count: 0 };
      dayProj[k].count++;
    }

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'vercel', metric_name: 'projects_total',   scope: '', value: projectCount, unit: 'count' },
      { day: today, vendor: 'vercel', metric_name: 'deployments_recent', scope: '', value: deps.length, unit: 'count' },
    ];
    for (const { day, scope, count } of Object.values(dayProj)) {
      metrics.push({ day, vendor: 'vercel', metric_name: 'deployments', scope, value: count, unit: 'count' });
    }

    // 3) Try to get usage/billing (Pro/Enterprise only — may 404 on Hobby)
    const usage = await fetchJson('https://api.vercel.com/v1/usage', auth);
    if (usage.ok && usage.body) {
      metrics.push({ day: today, vendor: 'vercel', metric_name: 'usage_snapshot', scope: '', value: 1, unit: 'snapshot', raw: usage.body });
    }

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('vercel', 'VERCEL_TOKEN');
    await finishRun(runId, 'ok', rows);
    return { rows, projects: projectCount, deployments: deps.length };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Cloudflare -----------------------------------------------------
async function syncCloudflare() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  if (!token) {
    await noteMissingKey('cloudflare', 'CLOUDFLARE_API_TOKEN', 'zone:read,account:read,analytics:read', 'Zone analytics + bandwidth', 'https://dash.cloudflare.com/profile/api-tokens');
    return { rows: 0, note: 'CLOUDFLARE_API_TOKEN missing' };
  }
  const runId = await startRun('cloudflare');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // 1) List zones
    const z = await fetchJson('https://api.cloudflare.com/client/v4/zones?per_page=50', auth);
    const zones = (z.body?.result || []).map(zz => ({ id: zz.id, name: zz.name }));

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'cloudflare', metric_name: 'zones_total', scope: '', value: zones.length, unit: 'count' },
    ];

    // 2) For each zone, fetch analytics (requests, bandwidth) for last 24h
    for (const zone of zones) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const until = new Date().toISOString();
      const an = await fetchJson(
        `https://api.cloudflare.com/client/v4/zones/${zone.id}/analytics/dashboard?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
        auth,
      );
      if (an.ok && an.body?.result?.totals) {
        const t = an.body.result.totals;
        metrics.push({ day: today, vendor: 'cloudflare', metric_name: 'requests_24h',  scope: zone.name, value: t.requests?.all || 0, unit: 'count' });
        metrics.push({ day: today, vendor: 'cloudflare', metric_name: 'bandwidth_24h', scope: zone.name, value: t.bandwidth?.all || 0, unit: 'bytes' });
        metrics.push({ day: today, vendor: 'cloudflare', metric_name: 'threats_24h',   scope: zone.name, value: t.threats?.all || 0, unit: 'count' });
      } else if (an.status === 403) {
        // analytics needs zone:analytics:read scope
      }
    }

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('cloudflare', 'CLOUDFLARE_API_TOKEN');
    await finishRun(runId, 'ok', rows);
    return { rows, zones: zones.length };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Hetzner --------------------------------------------------------
async function syncHetzner() {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    await noteMissingKey('hetzner', 'HETZNER_API_TOKEN', 'read', 'Server-status + monthly cost', 'https://console.hetzner.cloud/projects → Security → API tokens');
    return { rows: 0, note: 'HETZNER_API_TOKEN missing' };
  }
  const runId = await startRun('hetzner');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const srv = await fetchJson('https://api.hetzner.cloud/v1/servers', auth);
    const servers = srv.body?.servers || [];

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'hetzner', metric_name: 'servers_total',  scope: '', value: servers.length, unit: 'count' },
      { day: today, vendor: 'hetzner', metric_name: 'servers_running', scope: '', value: servers.filter(s => s.status === 'running').length, unit: 'count' },
    ];

    let totalMonthlyCost = 0;
    for (const s of servers) {
      const price = s.server_type?.prices?.[0]?.price_monthly?.gross;
      const cost = price ? parseFloat(price) : 0;
      totalMonthlyCost += cost;
      metrics.push({ day: today, vendor: 'hetzner', metric_name: 'server_status', scope: s.name, value: s.status === 'running' ? 1 : 0, unit: 'state', raw: { type: s.server_type?.name, datacenter: s.datacenter?.name } });
      if (cost) {
        metrics.push({ day: today, vendor: 'hetzner', metric_name: 'monthly_cost_eur', scope: s.name, value: cost, unit: 'eur', cost_usd: +(cost * 1.08).toFixed(4) });
      }
    }
    metrics.push({ day: today, vendor: 'hetzner', metric_name: 'total_monthly_cost_eur', scope: '', value: +totalMonthlyCost.toFixed(2), unit: 'eur', cost_usd: +(totalMonthlyCost * 1.08).toFixed(4) });

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('hetzner', 'HETZNER_API_TOKEN');
    await finishRun(runId, 'ok', rows);
    return { rows, servers: servers.length, monthly_eur: totalMonthlyCost.toFixed(2) };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

(async () => {
  console.log('--- Infra Sync ---');
  console.log('Vercel:    ', await syncVercel());
  console.log('Cloudflare:', await syncCloudflare());
  console.log('Hetzner:   ', await syncHetzner());
})();
