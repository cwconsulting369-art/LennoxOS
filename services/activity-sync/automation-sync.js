#!/usr/bin/env node
/**
 * Automation Sync — n8n + Make + GitHub Actions
 */
const { startRun, finishRun, noteMissingKey, resolveMissingKey, upsertMetrics, fetchJson, TODAY } = require('./lib');

// ---------- n8n -----------------------------------------------------------
async function syncN8n() {
  const key = process.env.N8N_API_KEY;
  const baseUrl = process.env.N8N_BASE_URL || 'https://n8n.lennoxos.com';
  if (!key) {
    await noteMissingKey('n8n', 'N8N_API_KEY', 'workflow:read,execution:read', 'Workflows + execution counts', `${baseUrl}/settings/api`);
    return { rows: 0, note: 'N8N_API_KEY missing' };
  }
  const runId = await startRun('n8n');
  let rows = 0;
  try {
    const auth = { headers: { 'X-N8N-API-KEY': key } };
    const wf = await fetchJson(`${baseUrl}/api/v1/workflows?limit=250`, auth);
    if (!wf.ok) throw new Error(`workflows: ${wf.status}${wf.body?._raw ? ' ' + wf.body._raw.slice(0, 100) : ''}`);
    const workflows = wf.body?.data || [];
    const active = workflows.filter(w => w.active).length;

    // executions in last 24h
    const ex = await fetchJson(`${baseUrl}/api/v1/executions?limit=250&status=success`, auth);
    const execs = ex.body?.data || [];
    const since = Date.now() - 24 * 3600 * 1000;
    const recent = execs.filter(e => new Date(e.startedAt || e.stoppedAt || 0).getTime() > since);

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'n8n', metric_name: 'workflows_total',    scope: '', value: workflows.length, unit: 'count' },
      { day: today, vendor: 'n8n', metric_name: 'workflows_active',   scope: '', value: active, unit: 'count' },
      { day: today, vendor: 'n8n', metric_name: 'executions_24h',     scope: '', value: recent.length, unit: 'count' },
      { day: today, vendor: 'n8n', metric_name: 'executions_recent', scope: '', value: execs.length, unit: 'count' },
    ];
    rows = await upsertMetrics(metrics);
    await resolveMissingKey('n8n', 'N8N_API_KEY');
    await finishRun(runId, 'ok', rows);
    return { rows, workflows: workflows.length, active, executions_24h: recent.length };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- Make.com ------------------------------------------------------
async function syncMake() {
  const key = process.env.MAKE_API_KEY;
  if (!key) {
    await noteMissingKey('make', 'MAKE_API_KEY', 'scenarios:read,executions:read', 'Scenarios + operation counts', 'https://www.make.com/en/help/api');
    return { rows: 0, note: 'MAKE_API_KEY missing' };
  }
  const runId = await startRun('make');
  let rows = 0;
  try {
    const zone = process.env.MAKE_ZONE || 'eu1.make.com';
    const teamId = process.env.MAKE_TEAM_ID;
    const auth = { headers: { Authorization: `Token ${key}` } };

    // List organizations to find teamId if not set
    if (!teamId) {
      const orgs = await fetchJson(`https://${zone}/api/v2/organizations`, auth);
      if (orgs.ok && orgs.body?.organizations?.length) {
        const o = orgs.body.organizations[0];
        // list teams in that org
        const teams = await fetchJson(`https://${zone}/api/v2/teams?organizationId=${o.id}`, auth);
        const t = teams.body?.teams?.[0];
        if (t) process.env.MAKE_TEAM_ID = String(t.id);
      }
    }
    const useTeamId = process.env.MAKE_TEAM_ID;
    if (!useTeamId) {
      await noteMissingKey('make', 'MAKE_TEAM_ID', 'config', 'Team-ID nicht ermittelbar — bitte in env hinterlegen', 'https://www.make.com');
      throw new Error('No team-id resolvable');
    }
    const sc = await fetchJson(`https://${zone}/api/v2/scenarios?teamId=${useTeamId}`, auth);
    const scenarios = sc.body?.scenarios || [];
    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'make', metric_name: 'scenarios_total',  scope: '', value: scenarios.length, unit: 'count' },
      { day: today, vendor: 'make', metric_name: 'scenarios_active', scope: '', value: scenarios.filter(s => s.isActive || s.scheduling?.type !== 'on-demand').length, unit: 'count' },
    ];
    rows = await upsertMetrics(metrics);
    await resolveMissingKey('make', 'MAKE_API_KEY');
    await finishRun(runId, 'ok', rows);
    return { rows, scenarios: scenarios.length };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

// ---------- GitHub Actions ------------------------------------------------
async function syncGitHub() {
  const key = process.env.GITHUB_TOKEN_MASTER || process.env.GITHUB_TOKEN;
  if (!key) {
    await noteMissingKey('github', 'GITHUB_TOKEN_MASTER', 'repo,workflow', 'Repo count + Actions usage', 'https://github.com/settings/tokens');
    return { rows: 0, note: 'GITHUB_TOKEN_MASTER missing' };
  }
  const runId = await startRun('github');
  let rows = 0;
  try {
    const auth = { headers: { Authorization: `Bearer ${key}`, Accept: 'application/vnd.github+json' } };

    // 1) User info + repo count
    const user = await fetchJson('https://api.github.com/user', auth);
    if (!user.ok) throw new Error(`user: ${user.status}`);
    const username = user.body?.login;
    const publicRepos = user.body?.public_repos || 0;
    const privateRepos = user.body?.total_private_repos || 0;

    // 2) Recent workflow runs in user repos (limited to first page)
    const runs = await fetchJson(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, auth);
    const repos = runs.body || [];

    // 3) Billing/actions usage (requires admin:org scope or user-level token)
    const billing = await fetchJson(`https://api.github.com/users/${username}/settings/billing/actions`, auth);
    let actionMinutes = null;
    if (billing.ok) {
      actionMinutes = billing.body?.total_minutes_used;
    }

    const today = TODAY();
    const metrics = [
      { day: today, vendor: 'github', metric_name: 'public_repos',  scope: '', value: publicRepos, unit: 'count' },
      { day: today, vendor: 'github', metric_name: 'private_repos', scope: '', value: privateRepos, unit: 'count' },
      { day: today, vendor: 'github', metric_name: 'repos_total',   scope: '', value: repos.length, unit: 'count' },
    ];
    if (actionMinutes != null) {
      metrics.push({ day: today, vendor: 'github', metric_name: 'actions_minutes_month', scope: '', value: actionMinutes, unit: 'minutes', raw: billing.body });
    } else {
      await noteMissingKey('github', 'GITHUB_TOKEN_BILLING_SCOPE', 'admin:org or user', 'Actions-Minutes-Usage (token hat keinen billing-scope)', 'https://github.com/settings/tokens');
    }

    rows = await upsertMetrics(metrics);
    await resolveMissingKey('github', 'GITHUB_TOKEN_MASTER');
    await finishRun(runId, 'ok', rows);
    return { rows, user: username, repos: repos.length, actions_minutes: actionMinutes };
  } catch (err) {
    await finishRun(runId, 'error', rows, err);
    return { rows, error: String(err).slice(0, 200) };
  }
}

(async () => {
  console.log('--- Automation Sync ---');
  console.log('n8n:    ', await syncN8n());
  console.log('Make:   ', await syncMake());
  console.log('GitHub: ', await syncGitHub());
})();
