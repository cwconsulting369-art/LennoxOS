const express = require('express');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Load .env (lennox-os local) + optional ~/.envs/aevum.env for AEVUM_ADMIN_TOKEN
function loadEnvFile(p) {
  try {
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [k, ...v] = trimmed.split('=');
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim();
      }
    });
  } catch {}
}
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile('/home/carlos/.envs/aevum.env');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_IDEAS_BASE = process.env.AIRTABLE_IDEAS_BASE || 'appJDdfkdzsIhuSUc';
const AIRTABLE_IDEAS_TABLE = process.env.AIRTABLE_IDEAS_TABLE || 'tblpLr3Tb9AlojdVE';

const app = express();
// Trust Cloudflare-Tunnel forwarded IPs (single hop) — fixes express-rate-limit X-Forwarded-For validation
app.set('trust proxy', 1);
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const auth = require('/home/carlos/shared/auth-db.cjs');

// DB pool for auth
const authPool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://paperclip:paperclip123@127.0.0.1:5432/paperclip' });

// Cookie middleware
app.use(cookieParser());
const PORT = process.env.PORT || 4000;
const PM2 = '/home/carlos/.nvm/versions/node/v22.22.2/bin/pm2';
const PAPERCLIP = 'http://127.0.0.1:3100';

async function pcFetch(url, opts = {}, timeoutMs = 800) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    return r;
  } finally { clearTimeout(tm); }
}
const COMPANY = '7b5160b6-fd57-44b9-a3ba-f989e15a8597';

const ALLOWED_SERVICES = [
  'cloudflared-tunnel','idea-factory-bot','lennox-os','lennox-terminal',
  'openrouter-bridge','paperclip','weekly-insight',
  'lennox-gold-bot','chart-api','agent-core',
];

app.use(express.json());

// ── Security ──────────────────────────────────────────────────────────────────
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Rate limit on login (15 attempts per 15min per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/auth/login', loginLimiter);

// Lennox-internal access: localhost + no cf-tunnel header = trusted (read-only-safe).
// Cloudflared sets 'cf-connecting-ip' for external requests; absence means VPS-internal.
function isLennoxInternal(req) {
  const ip = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
  const isLocal = ip === '127.0.0.1' || ip === '::1';
  const viaCfTunnel = !!req.headers['cf-connecting-ip'];
  return isLocal && !viaCfTunnel;
}

// Auth middleware — runs before all routes
// Skips: /auth/*, /login, /api/auth/*
// Bypass for Lennox-AI/internal services (see memory:lennox-internal-access)
function requireLennoxAuth(req, res, next) {
  if (isLennoxInternal(req)) {
    req.authUser = { username: 'lennox-internal', dashboard: 'lennox', internal: true };
    return next();
  }
  const token = req.cookies?.[auth.COOKIE_NAME];
  const payload = auth.verifyToken(token || '');
  if (!payload || payload.dashboard !== 'lennox') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.authUser = payload;
  next();
}

app.use((req, res, next) => {
  if (
    req.path.startsWith('/auth/') ||
    req.path === '/login' ||
    req.path.startsWith('/api/auth/')
  ) return next();
  return requireLennoxAuth(req, res, next);
});
// ─────────────────────────────────────────────────────────────────────────────

const terminalProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:7681',
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/terminal': '' },
});
app.use('/terminal', terminalProxy);

// Services

app.get('/api/services', (_req, res) => {
  try {
    const raw = execFileSync(PM2, ['jlist'], { timeout: 8000 }).toString();
    const list = JSON.parse(raw);
    const services = list.map(p => ({
      id: p.pm_id,
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      uptime: p.pm2_env?.pm_uptime || null,
      restarts: p.pm2_env?.restart_time || 0,
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      pid: p.pid || null,
    }));
    res.json(services);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:name/restart', (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_SERVICES.includes(name)) {
    return res.status(403).json({ error: 'Service not allowed' });
  }
  try {
    execFileSync(PM2, ['restart', name], { timeout: 10000 });
    res.json({ ok: true, message: `Restarted ${name}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:name/stop', (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_SERVICES.includes(name)) {
    return res.status(403).json({ error: 'Service not allowed' });
  }
  try {
    execFileSync(PM2, ['stop', name], { timeout: 10000 });
    res.json({ ok: true, message: `Stopped ${name}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Paperclip Issues

app.get('/api/issues', async (_req, res) => {
  try {
    const response = await pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues?limit=50`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ standby: true, items: [] });
  }
});

app.get('/api/issues/:id', async (req, res) => {
  try {
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues/${req.params.id}`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.post('/api/issues', async (req, res) => {
  try {
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// System Monitor

app.get('/api/monitor', (_req, res) => {
  try {
    // CPU load average
    const loadAvgRaw = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
    const loadAvg = {
      '1m': parseFloat(loadAvgRaw[0]),
      '5m': parseFloat(loadAvgRaw[1]),
      '15m': parseFloat(loadAvgRaw[2]),
    };
    const cpuCores = parseInt(execSync('nproc', { timeout: 2000 }).toString().trim()) || 1;
    const loadPct = Math.min(100, Math.round((loadAvg['1m'] / cpuCores) * 100));

    // Memory
    const memRaw = fs.readFileSync('/proc/meminfo', 'utf8');
    const memTotal = parseInt(memRaw.match(/MemTotal:\s+(\d+)/)[1]) * 1024;
    const memAvail = parseInt(memRaw.match(/MemAvailable:\s+(\d+)/)[1]) * 1024;
    const memUsed = memTotal - memAvail;

    // Disk
    const diskRaw = execSync("df -h / 2>/dev/null | tail -1", { timeout: 3000 }).toString().trim().split(/\s+/);
    const diskTotal = diskRaw[1];
    const diskUsed = diskRaw[2];
    const diskFree = diskRaw[3];
    const diskPct = diskRaw[4];

    // Uptime
    const uptime = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);

    res.json({
      cpu: { cores: cpuCores, loadPct },
      loadAvg,
      memory: { total: memTotal, used: memUsed },
      disk: { total: diskTotal, used: diskUsed, free: diskFree, pct: diskPct },
      uptime,
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Logs

app.get('/api/logs/:name', (req, res) => {
  const { name } = req.params;
  if (!ALLOWED_SERVICES.includes(name)) {
    return res.status(403).json({ error: 'Service not allowed' });
  }
  const lines = parseInt(req.query.lines) || 100;
  try {
    // Read stdout and stderr log files directly for clean split
    const pm2Home = process.env.PM2_HOME || '/root/.pm2';
    const pm2HomeCarlos = '/home/carlos/.pm2';
    let out = '';
    let err = '';
    for (const base of [pm2HomeCarlos, pm2Home]) {
      const outFile = `${base}/logs/${name}-out.log`;
      const errFile = `${base}/logs/${name}-error.log`;
      if (fs.existsSync(outFile)) {
        const allLines = fs.readFileSync(outFile, 'utf8').split('\n');
        out = allLines.slice(-lines).join('\n');
      }
      if (fs.existsSync(errFile)) {
        const allLines = fs.readFileSync(errFile, 'utf8').split('\n');
        err = allLines.slice(-lines).join('\n');
      }
      if (out || err) break;
    }
    res.json({ name, out, err });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ideas





// Files

const ALLOWED_ROOTS = [
  '/home/carlos',
];

function isAllowedPath(p) {
  const resolved = path.resolve(p);
  return ALLOWED_ROOTS.some(root => resolved.startsWith(root));
}

app.get('/api/files', (req, res) => {
  const reqPath = req.query.path || '/home/carlos/personal-os';
  if (!isAllowedPath(reqPath)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    const stat = fs.statSync(reqPath);
    if (stat.isFile()) {
      // Return file content
      const content = fs.readFileSync(reqPath, 'utf8');
      res.json({ path: reqPath, type: 'file', content });
      return;
    }
    const rawEntries = fs.readdirSync(reqPath, { withFileTypes: true });
    const entries = rawEntries.map(e => {
      const full = path.join(reqPath, e.name);
      let size = 0, mtime = 0, birthtime = 0;
      try {
        const s = fs.statSync(full);
        size = s.size;
        mtime = s.mtimeMs;
        birthtime = s.birthtimeMs;
      } catch {}
      return { name: e.name, type: e.isDirectory() ? 'dir' : 'file', size, mtime, birthtime };
    }).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ path: reqPath, type: 'dir', entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath || !isAllowedPath(filePath)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ path: filePath, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/files/write', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || !isAllowedPath(filePath)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Processes

app.get('/api/system/processes', (_req, res) => {
  try {
    const raw = execSync('ps aux --sort=-%cpu 2>/dev/null', { timeout: 5000 }).toString();
    const lines = raw.trim().split('\n');
    const procs = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parseInt(parts[1]) || 0,
        user: parts[0],
        cpu: parseFloat(parts[2]) || 0,
        memory: parseFloat(parts[3]) || 0,
        command: parts.slice(10).join(' ').slice(0, 100),
        started: parts[8] || '',
      };
    }).filter(p => p.pid > 0);
    res.json({ processes: procs, total: procs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// VPS Agents (PM2 processes)

app.get('/api/vps-agents', (_req, res) => {
  try {
    const raw = execFileSync(PM2, ['jlist'], { timeout: 8000 }).toString();
    const list = JSON.parse(raw);
    const agents = list.map(p => ({
      id: `vps-${p.pm_id}`,
      name: p.name,
      type: 'vps',
      status: p.pm2_env?.status || 'unknown',
      pid: p.pid,
      uptime: p.pm2_env?.pm_uptime || null,
      restarts: p.pm2_env?.restart_time || 0,
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
    }));
    res.json({ agents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Paperclip Agents

app.get('/api/agents', async (_req, res) => {
  try {
    const response = await pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/agents`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.json({ standby: true, items: [] });
  }
});

// Pipeline

app.get('/api/pipeline', (_req, res) => {
  const BASE = '/home/carlos/personal-os/03-pipeline';
  const stages = ['leads', 'prospects', 'customers', '99-archive'];
  const result = {};
  for (const stage of stages) {
    const dir = path.join(BASE, stage);
    result[stage] = [];
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const fm = {};
        if (fmMatch) {
          fmMatch[1].split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx === -1) return;
            fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          });
        }
        const titleMatch = content.match(/^# (.+)/m);
        result[stage].push({
          file,
          name: fm.name || (titleMatch ? titleMatch[1] : file.replace('.md', '')),
          status: fm.status || stage.replace('99-', ''),
          priority: fm.priority || 'C',
          lastContact: fm['last-contact'] || '',
          nextAction: fm['next-action'] || '',
          dealValue: fm['deal-value'] || '',
          contact: fm['contact'] || '',
          linkedIssue: fm['linked-issue'] || '',
        });
      } catch {}
    }
  }
  res.json(result);
});

// Network

app.get('/api/network', (_req, res) => {
  try {
    let ports = [];
    try {
      const ssOut = execSync('ss -tuln 2>/dev/null', { timeout: 5000 }).toString();
      ssOut.split('\n').slice(1).forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) return;
        const addrPort = parts[4];
        const portMatch = addrPort.match(/:(\d+)$/);
        if (!portMatch) return;
        const port = parseInt(portMatch[1]);
        if (!port || port < 1) return;
        ports.push({ proto: parts[0], local: addrPort, port, state: parts[1] || '-' });
      });
    } catch {}
    let interfaces = [];
    try {
      const devRaw = fs.readFileSync('/proc/net/dev', 'utf8');
      devRaw.split('\n').slice(2).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const [iface, ...nums] = trimmed.split(/[:\s]+/);
        if (!iface || iface === 'lo') return;
        const n = nums.map(Number);
        interfaces.push({ name: iface, rxBytes: n[0] || 0, txBytes: n[8] || 0, rxPackets: n[1] || 0, txPackets: n[9] || 0 });
      });
    } catch {}
    const unique = ports.filter((p, i, arr) => arr.findIndex(x => x.port === p.port && x.proto === p.proto) === i);
    res.json({ ports: unique.sort((a, b) => a.port - b.port), interfaces });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Projects — Paperclip-based with lead agent + issue count

app.get('/api/projects', async (_req, res) => {
  try {
    const [projRes, agentRes, issueRes, labelRes] = await Promise.all([
      pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/projects`),
      pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/agents`),
      pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues?limit=200`),
      pcFetch(`${PAPERCLIP}/api/companies/${COMPANY}/labels`),
    ]);
    const [projects, agents, issues, labels] = await Promise.all([
      projRes.json(), agentRes.json(), issueRes.json(), labelRes.json(),
    ]);

    const agentMap = {};
    for (const a of (Array.isArray(agents) ? agents : [])) agentMap[a.id] = a.name;

    const labelMap = {};
    for (const l of (Array.isArray(labels) ? labels : [])) labelMap[l.id] = l;

    const issueList = Array.isArray(issues) ? issues : (issues.issues || []);

    const DASHBOARD_URLS = {
      "Ketolabs": "https://ketolabs.lennoxos.com",
      "UtilityHub": "https://utility-hub.one",
      "LennoxOS": "https://lennoxos.com",
    };

    const result = (Array.isArray(projects) ? projects : [])
      .filter(p => !p.archivedAt)
      .map(p => {
        const projNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchLabel = (Array.isArray(labels) ? labels : []).find(l => {
          const lnorm = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return projNorm.includes(lnorm) || lnorm.includes(projNorm);
        });
        const openIssues = issueList.filter(i =>
          i.status !== 'done' &&
          matchLabel &&
          Array.isArray(i.labelIds) &&
          i.labelIds.includes(matchLabel.id)
        ).length;
        return {
          id: p.id,
          name: p.name,
          color: p.color || '#6366f1',
          status: p.status || 'backlog',
          leadAgentName: p.leadAgentId ? (agentMap[p.leadAgentId] || null) : null,
          openIssues,
          dashboardUrl: DASHBOARD_URLS[p.name] || null,
        };
      });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Labels

app.get('/api/labels', async (_req, res) => {
  try {
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/labels`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Today

app.get('/api/today', (_req, res) => {
  try {
    const content = fs.readFileSync('/home/carlos/personal-os/02-tasks/today.md', 'utf8');
    res.json({ content });
  } catch (e) {
    res.status(404).json({ content: '# Heute\n\nKeine Tasks.', error: e.message });
  }
});

// Waiting For
app.get('/api/waiting', (_req, res) => {
  try {
    const wContent = fs.readFileSync('/home/carlos/personal-os/02-tasks/waiting-for.md', 'utf8');
    res.json({ content: wContent });
  } catch (e) {
    res.status(404).json({ content: '', error: e.message });
  }
});

// Morning Brief
app.get('/api/brief', (_req, res) => {
  try {
    const content = fs.readFileSync('/home/carlos/personal-os/02-tasks/morning-brief.md', 'utf8');
    const match = content.match(/^generated: (.+)$/m);
    const generatedAt = match ? match[1] : null;
    res.json({ content, generatedAt });
  } catch (e) {
    res.status(404).json({ content: null, generatedAt: null, error: e.message });
  }
});

// Links
const LINKS_FILE = path.join(__dirname, 'links.json');
app.get('/api/links', (_req, res) => {
  try {
    const data = fs.existsSync(LINKS_FILE) ? JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) : [];
    res.json({ links: data });
  } catch (e) { res.status(500).json({ links: [], error: e.message }); }
});
app.post('/api/links', (req, res) => {
  try {
    const data = fs.existsSync(LINKS_FILE) ? JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) : [];
    const { title, url, category, description } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'title and url required' });
    const entry = {
      id: Date.now().toString(),
      title: title.trim(),
      url: url.trim(),
      category: (category || 'Other').trim(),
      description: (description || '').trim(),
      added: new Date().toISOString().split('T')[0],
    };
    data.unshift(entry);
    fs.writeFileSync(LINKS_FILE, JSON.stringify(data, null, 2));
    res.json({ link: entry });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/links/:id', (req, res) => {
  try {
    const data = fs.existsSync(LINKS_FILE) ? JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) : [];
    const filtered = data.filter(l => l.id !== req.params.id);
    fs.writeFileSync(LINKS_FILE, JSON.stringify(filtered, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Backups
app.get('/api/backups', (_req, res) => {
  try {
    const backupDir = '/home/carlos/backups';
    const entries = [];
    function scan(dir, depth = 0) {
      if (depth > 1) return;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          scan(full, depth + 1);
        } else {
          const stat = fs.statSync(full);
          entries.push({
            name: item.name,
            path: full.replace('/home/carlos/backups/', ''),
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          });
        }
      }
    }
    scan(backupDir);
    entries.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ backups: entries });
  } catch (e) { res.status(500).json({ backups: [], error: e.message }); }
});

// Static + SPA fallback

// GoldBot multi-bot endpoint — fetches B1-B4 in parallel
const BOT_PORTS = { B1: 8001, B2: 8002, B3: 8003, B4: 8004 };
const BOT_PROFILES = { B1: 'CONSERVATIVE', B2: 'AGGRESSIVE', B3: 'SWING', B4: 'SCALP' };

async function fetchBotEndpoint(port, path) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e.message || 'offline' };
  }
}

// ─── GTS-OS Sync Board ─────────────────────────────────────────────────────
// Aggregator: Kevin's tasks + bot status + Vercel deployment.
// Read-only — both dashboards (Kevin-OS + GTS-OS in lennox-os) read this.
// ─── Master Dashboard (Workspace) ────────────────────────────────────────
// Aggregator über alle Projekte/OS: Cashflow, Agents, Traffic, Project-Status.
// Caching: 60s in-memory.
const masterCache = { ts: 0, data: null };
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

async function stripeMRR() {
  if (!STRIPE_SECRET_KEY) return null;
  try {
    const r = await fetch('https://api.stripe.com/v1/subscriptions?status=active&limit=100', {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const j = await r.json();
    if (!j.data) return null;
    let mrr = 0, count = 0;
    for (const s of j.data) {
      for (const it of (s.items?.data || [])) {
        const price = it.price;
        if (!price?.unit_amount) continue;
        const interval = price.recurring?.interval;
        const intCount = price.recurring?.interval_count || 1;
        let monthly = price.unit_amount * (it.quantity || 1) / 100;
        if (interval === 'year') monthly = monthly / 12;
        if (interval === 'week') monthly = monthly * 4.33;
        if (interval === 'day') monthly = monthly * 30;
        mrr += monthly / intCount;
        count++;
      }
    }
    return { mrr: Math.round(mrr * 100) / 100, subscriptions: j.data.length, itemCount: count };
  } catch (e) { return { error: e.message }; }
}

async function stripeRecentRevenue(days = 30) {
  if (!STRIPE_SECRET_KEY) return null;
  try {
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const r = await fetch(`https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const j = await r.json();
    if (!j.data) return null;
    const succeeded = j.data.filter(c => c.status === 'succeeded');
    const total = succeeded.reduce((sum, c) => sum + c.amount, 0) / 100;
    // Per-project split via metadata.project (if set) else 'unassigned'
    const byProject = {};
    for (const c of succeeded) {
      const proj = c.metadata?.project || 'unassigned';
      byProject[proj] = (byProject[proj] || 0) + c.amount / 100;
    }
    // Build daily revenue series
    const series = {};
    succeeded.forEach(c => {
      const d = new Date(c.created * 1000).toISOString().split('T')[0];
      series[d] = (series[d] || 0) + c.amount / 100;
    });
    const dailyRevenue = Object.entries(series)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));
    return { totalCents: Math.round(total * 100), total, dailyRevenue, count: j.data.length, byProject };
  } catch (e) { return { error: e.message }; }
}

async function paperclipAgentSummary() {
  try {
    const COMPANY = '7b5160b6-fd57-44b9-a3ba-f989e15a8597';
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 800);
    const r = await fetch(`http://127.0.0.1:3100/api/companies/${COMPANY}/agents`, { signal: ctrl.signal });
    clearTimeout(tm);
    if (!r.ok) return { standby: true };
    const agents = await r.json();
    const arr = Array.isArray(agents) ? agents : (agents.items || []);
    return {
      total: arr.length,
      active: arr.filter(a => ['idle', 'running', 'in_progress'].includes(a.status)).length,
      error: arr.filter(a => a.status === 'error').length,
      list: arr.map(a => ({ id: a.id, name: a.nameKey || a.name, status: a.status })),
    };
  } catch (e) { return { standby: true }; }
}

async function pm2ServicesSummary() {
  try {
    const raw = execSync(`${PM2} jlist`, { encoding: 'utf8', timeout: 3000 });
    const procs = JSON.parse(raw);
    return {
      total: procs.length,
      online: procs.filter(p => p.pm2_env?.status === 'online').length,
      errored: procs.filter(p => p.pm2_env?.status === 'errored').length,
      stopped: procs.filter(p => p.pm2_env?.status === 'stopped').length,
    };
  } catch (e) { return { error: e.message }; }
}

async function vercelDeployments() {
  if (!process.env.VERCEL_TOKEN) return null;
  try {
    const r = await fetch('https://api.vercel.com/v9/projects?limit=20', {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    });
    const j = await r.json();
    return {
      total: j.projects?.length || 0,
      names: (j.projects || []).map(p => p.name),
    };
  } catch (e) { return { error: e.message }; }
}

async function cloudflareTraffic() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CF_ZONE_ID) return null;
  try {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/analytics/dashboard?since=${encodeURIComponent(since)}&continuous=false`,
      { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } }
    );
    const j = await r.json();
    if (!j.success) return { error: j.errors?.[0]?.message || 'cf error' };
    const totals = j.result?.totals || {};
    return {
      requests24h: totals.requests?.all || 0,
      bandwidth24h: totals.bandwidth?.all || 0,
      uniques24h: totals.uniques?.all || 0,
      cacheRatio: totals.requests?.all ? Math.round((totals.requests.cached / totals.requests.all) * 100) : 0,
    };
  } catch (e) { return { error: e.message }; }
}

// Per-OS quick metrics (fast counts from Supabase)
async function osQuickMetrics() {
  const out = {};
  // AEVUM
  if (process.env.AEVUM_SUPABASE_URL && process.env.AEVUM_SUPABASE_SERVICE_KEY) {
    try {
      const headers = { apikey: process.env.AEVUM_SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.AEVUM_SUPABASE_SERVICE_KEY}`, Prefer: 'count=exact' };
      const [orders, audits, pilot, consents] = await Promise.all([
        fetch(`${process.env.AEVUM_SUPABASE_URL}/rest/v1/orders?select=*&limit=0`, { headers }),
        fetch(`${process.env.AEVUM_SUPABASE_URL}/rest/v1/audits?select=*&limit=0`, { headers }),
        fetch(`${process.env.AEVUM_SUPABASE_URL}/rest/v1/pilot_slots?select=*&limit=0`, { headers }),
        fetch(`${process.env.AEVUM_SUPABASE_URL}/rest/v1/consent_log?select=*&limit=0`, { headers }),
      ]);
      const cnt = r => parseInt((r.headers.get('content-range') || '*/0').split('/')[1] || '0', 10);
      out.aevum = { orders: cnt(orders), audits: cnt(audits), pilots: cnt(pilot), consents: cnt(consents) };
    } catch (e) { out.aevum = { error: e.message }; }
  }
  // UH (already fetched via /api/uh/board, but include shortcut)
  if (process.env.UH_SUPABASE_URL && process.env.UH_SUPABASE_SERVICE_KEY) {
    try {
      const headers = { apikey: process.env.UH_SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.UH_SUPABASE_SERVICE_KEY}`, Prefer: 'count=exact' };
      const [customers, orgs] = await Promise.all([
        fetch(`${process.env.UH_SUPABASE_URL}/rest/v1/customers?select=*&limit=0`, { headers }),
        fetch(`${process.env.UH_SUPABASE_URL}/rest/v1/organizations?select=*&limit=0`, { headers }),
      ]);
      const cnt = r => parseInt((r.headers.get('content-range') || '*/0').split('/')[1] || '0', 10);
      out.utilityhub = { customers: cnt(customers), organizations: cnt(orgs) };
    } catch (e) { out.utilityhub = { error: e.message }; }
  }
  // GTS (from paperclip DB)
  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: 'postgresql://paperclip:paperclip123@127.0.0.1:5432/paperclip' });
    const r = await pool.query('SELECT COUNT(*)::int as signals FROM gts_signals');
    await pool.end();
    out.gts = { signals: r.rows[0].signals };
  } catch (e) { out.gts = { error: e.message }; }
  // Kevin (blueprints + submissions)
  try {
    const dir = '/home/kevin/inbox/blueprints';
    const dir2 = '/home/kevin/workspace/submissions';
    out.kevin = {
      blueprints: fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).length : 0,
      submissions: fs.existsSync(dir2) ? fs.readdirSync(dir2).length : 0,
    };
  } catch (e) { out.kevin = { error: e.message }; }
  return out;
}

async function osHealthChecks() {
  const targets = [
    { id: 'aevum',     name: 'AEVUM',           url: 'https://aevum-os.lennoxos.com', revenueSource: 'stripe' },
    { id: 'gts',       name: 'GoldTraderSociety', url: 'https://goldtradersociety.com', revenueSource: 'stripe' },
    { id: 'kevin',     name: 'K3ngama (Kevin)', url: 'https://kevin.lennoxos.com', revenueSource: 'none' },
    { id: 'ketolabs',  name: 'Ketolabs',        url: 'https://ketolabs.lennoxos.com', revenueSource: 'tbd' },
    { id: 'utilityhub',name: 'UtilityHub',      url: 'https://utility-hub.one', revenueSource: 'miguel-share' },
    { id: 'thailand',  name: 'Thailand RE',     url: 'https://thailand.lennoxos.com', revenueSource: 'fixed' },
    { id: 'script',    name: 'Script Factory',  url: 'https://script.lennoxos.com', revenueSource: 'tbd' },
  ];
  const results = await Promise.all(targets.map(async t => {
    try {
      const r = await fetch(t.url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      return { ...t, status: r.ok ? 'live' : 'down', httpStatus: r.status };
    } catch { return { ...t, status: 'down' }; }
  }));
  return results;
}

// ─── Cross-OS Event-Hub ──────────────────────────────────────────────────
// Any project-OS can POST to /api/event/<project> with arbitrary payload.
// Stored in-memory + appended to file. Carlos sees in Master Dashboard activity feed.
const projectEvents = []; // { project, type, payload, ts }
const EVENT_FILE = '/var/log/lennox/project-events.jsonl';

function recordEvent(project, type, payload) {
  const ev = { project, type, payload, ts: new Date().toISOString() };
  projectEvents.push(ev);
  if (projectEvents.length > 500) projectEvents.shift();
  try { fs.appendFileSync(EVENT_FILE, JSON.stringify(ev) + '\n'); } catch {}
  return ev;
}

app.post('/api/event/:project', (req, res) => {
  const { project } = req.params;
  const { type, ...payload } = req.body || {};
  if (!project || !type) return res.status(400).json({ error: 'project + type required' });
  const ev = recordEvent(project, type, payload);
  res.json({ ok: true, ev });
});

app.get('/api/events/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const project = req.query.project;
  let events = projectEvents.slice(-limit).reverse();
  if (project) events = events.filter(e => e.project === project);
  res.json({ events, total: projectEvents.length });
});

app.get('/api/master/overview', async (_req, res) => {
  if (Date.now() - masterCache.ts < 60_000 && masterCache.data) {
    return res.json({ ...masterCache.data, cached: true });
  }
  const [mrr, recent, agents, services, vercel, traffic, osHealth, osMetrics] = await Promise.all([
    stripeMRR(),
    stripeRecentRevenue(30),
    paperclipAgentSummary(),
    pm2ServicesSummary(),
    vercelDeployments(),
    cloudflareTraffic(),
    osHealthChecks(),
    osQuickMetrics(),
  ]);
  const data = {
    generatedAt: new Date().toISOString(),
    cashflow: { mrr, recent },
    agents,
    services,
    vercel,
    traffic,
    osHealth,
    osMetrics,
  };
  masterCache.ts = Date.now();
  masterCache.data = data;
  res.json(data);
});

// ─── Ketolabs Board ──────────────────────────────────────────────────────
async function klaviyoCall(path) {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://a.klaviyo.com/api${path}`, {
      headers: {
        Authorization: `Klaviyo-API-Key ${key}`,
        revision: '2024-10-15',
        Accept: 'application/vnd.api+json',
      },
    });
    return await r.json();
  } catch (e) { return { error: e.message }; }
}

app.get('/api/ketolabs/board', async (_req, res) => {
  const out = { generatedAt: new Date().toISOString(), sources: {} };
  // Klaviyo
  try {
    const [acct, lists, profilesProbe, campaigns] = await Promise.all([
      klaviyoCall('/accounts/'),
      klaviyoCall('/lists/?page%5Bsize%5D=50'),
      klaviyoCall('/profiles/?page%5Bsize%5D=1'),
      klaviyoCall('/campaigns/?filter=equals(messages.channel,%22email%22)&page%5Bsize%5D=10&sort=-send_time'),
    ]);
    const accountInfo = acct?.data?.[0]?.attributes || {};
    out.sources.klaviyo = {
      connected: !!acct?.data,
      account_email: accountInfo.contact_information?.default_sender_email,
      organization: accountInfo.contact_information?.organization_name,
      locale: accountInfo.locale,
      lists_count: lists?.data?.length || 0,
      lists: (lists?.data || []).slice(0, 5).map(l => ({
        id: l.id, name: l.attributes?.name, created: l.attributes?.created,
      })),
      recent_campaigns: (campaigns?.data || []).slice(0, 5).map(c => ({
        name: c.attributes?.name,
        status: c.attributes?.status,
        send_time: c.attributes?.send_time,
      })),
    };
  } catch (e) { out.sources.klaviyo = { connected: false, error: e.message }; }
  // Google Ads (not connected)
  out.sources.googleAds = { connected: false, reason: 'No Developer Token + Customer ID yet (Carlos action)' };
  // Meta Ads (not connected)
  out.sources.meta = { connected: false, reason: 'Pending Kevin Beretta as BM-Admin' };
  // Shopify (not connected)
  out.sources.shopify = { connected: false, reason: 'Pending Kevin Beretta as Shop-Owner' };
  // Summary
  const connected = Object.values(out.sources).filter(s => s.connected).length;
  out.summary = { connected, total: 4, label: `${connected}/4 sources connected` };
  res.json(out);
});

// ─── UH Board ────────────────────────────────────────────────────────────
async function sb(table, qs = 'select=*&limit=0') {
  const url = process.env.UH_SUPABASE_URL;
  const key = process.env.UH_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/${table}?${qs}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    });
    const count = parseInt((r.headers.get('content-range') || '*/0').split('/')[1] || '0', 10);
    let body = null;
    if (qs.includes('limit=0') === false) {
      try { body = await r.json(); } catch {}
    }
    return { count, body };
  } catch (e) { return { error: e.message }; }
}

app.get('/api/uh/board', async (_req, res) => {
  const out = { generatedAt: new Date().toISOString() };
  const [customers, orgs, docs, erasure, exports_, audits, contacts] = await Promise.all([
    sb('customers'),
    sb('organizations'),
    sb('customer_documents'),
    sb('erasure_requests'),
    sb('export_requests'),
    sb('audit_logs'),
    sb('contacts'),
  ]);
  out.counts = {
    customers: customers?.count ?? null,
    organizations: orgs?.count ?? null,
    documents: docs?.count ?? null,
    pendingErasure: erasure?.count ?? null,
    pendingExports: exports_?.count ?? null,
    auditLogs: audits?.count ?? null,
    contacts: contacts?.count ?? null,
  };

  // Recent customers (column might be full_name)
  const recentCust = await sb('customers', 'select=id,full_name,created_at,organization_id&order=created_at.desc&limit=5');
  out.recentCustomers = Array.isArray(recentCust?.body) ? recentCust.body : [];

  // Open DSGVO requests
  const openErasure = await sb('erasure_requests', 'select=id,customer_id,status,created_at&status=eq.pending&limit=10');
  out.openErasure = openErasure?.body || [];

  // Vercel deployment for utility-hub-dashboard
  try {
    if (process.env.VERCEL_TOKEN) {
      // Find UH project
      const proj = await fetch('https://api.vercel.com/v9/projects?limit=20', {
        headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
      }).then(r => r.json());
      const uhProj = proj.projects?.find(p => p.name.toLowerCase().includes('utility'));
      if (uhProj) {
        const dep = await fetch(`https://api.vercel.com/v6/deployments?projectId=${uhProj.id}&limit=1&target=production`, {
          headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
        }).then(r => r.json());
        const d = dep.deployments?.[0];
        if (d) {
          out.web = {
            state: d.state,
            url: 'https://utility-hub.one',
            deployedAt: new Date(d.createdAt).toISOString(),
            branch: d.meta?.githubCommitRef,
            commit: (d.meta?.githubCommitMessage || '').split('\n')[0].slice(0, 100),
          };
        }
      }
    }
  } catch (e) { out.webError = e.message; }

  res.json(out);
});

// GTS Telegram channel stats — uses Gold-Bot token (admin in channel)
async function gtsChannelStats() {
  const token = process.env.GOLD_BOT_TOKEN;
  if (!token) return null;
  const CH = -1003728330496;
  try {
    const [chat, count] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${CH}`).then(r => r.json()),
      fetch(`https://api.telegram.org/bot${token}/getChatMembersCount?chat_id=${CH}`).then(r => r.json()),
    ]);
    if (!chat.ok) return { error: chat.description };
    const inviteLink = chat.result.invite_link || `https://t.me/+5Upt85UBCXhjN2Y6`;
    return {
      title: chat.result.title,
      type: chat.result.type,
      memberCount: count.ok ? count.result : null,
      inviteLink,
      hasHistory: chat.result.has_visible_history,
    };
  } catch (e) { return { error: e.message }; }
}

// GTS signal stats from paperclip DB
async function gtsSignalStats() {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: 'postgresql://paperclip:paperclip123@127.0.0.1:5432/paperclip',
    });
    const totalQ = await pool.query('SELECT COUNT(*)::int as count, MAX(created_at) as last_signal FROM gts_signals');
    const recent = await pool.query(`
      SELECT signal_id, direction, entry_mid, sl, tp1, tp2, tp3, tg_message_id, created_at
      FROM gts_signals
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const tpStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE tp1_hit_at IS NOT NULL)::int as tp1_hits,
        COUNT(*) FILTER (WHERE tp2_hit_at IS NOT NULL)::int as tp2_hits,
        COUNT(*) FILTER (WHERE tp3_hit_at IS NOT NULL)::int as tp3_hits,
        COUNT(*) FILTER (WHERE sl_hit_at IS NOT NULL)::int as sl_hits
      FROM gts_signals
    `);
    await pool.end();
    return {
      total: totalQ.rows[0].count,
      lastSignal: totalQ.rows[0].last_signal,
      recent: recent.rows,
      outcomes: tpStats.rows[0],
    };
  } catch (e) { return { error: e.message }; }
}

app.get('/api/gts/stats', async (_req, res) => {
  const [channel, signals] = await Promise.all([
    gtsChannelStats(),
    gtsSignalStats(),
  ]);
  res.json({ channel, signals, generatedAt: new Date().toISOString() });
});

app.get('/api/gts/board', async (_req, res) => {
  const KEVIN_HOME = '/home/kevin';
  const out = { blueprints: [], submissions: [], bots: [], web: null, generatedAt: new Date().toISOString() };

  try {
    const dir = path.join(KEVIN_HOME, 'inbox', 'blueprints');
    out.blueprints = fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, size: st.size, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch (e) { out.blueprintsError = e.message; }

  try {
    const dir = path.join(KEVIN_HOME, 'workspace', 'submissions');
    out.submissions = fs.readdirSync(dir, { withFileTypes: true })
      .map(e => {
        const p = path.join(dir, e.name);
        const st = fs.statSync(p);
        return { name: e.name, isDir: e.isDirectory(), mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch (e) { out.submissionsError = e.message; }

  try {
    const raw = execSync(`${PM2} jlist`, { encoding: 'utf8', timeout: 3000 });
    const procs = JSON.parse(raw);
    const gtsNames = ['kev-bot', 'kevin-os'];
    const goldBots = procs.filter(p =>
      gtsNames.includes(p.name) ||
      p.name.startsWith('gold-bot') ||
      p.name.includes('lennox-gold-bot')
    );
    out.bots = goldBots.map(p => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      memory: p.monit?.memory || 0,
      restarts: p.pm2_env?.restart_time || 0,
    }));
  } catch (e) { out.botsError = e.message; }

  try {
    if (process.env.VERCEL_TOKEN) {
      const projId = 'prj_TbTM8w8koIebe2u4c8cGdfgIoUl6';
      const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projId}&limit=1&target=production`, {
        headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
      });
      const j = await r.json();
      const d = j.deployments?.[0];
      if (d) {
        out.web = {
          state: d.state,
          url: 'https://goldtradersociety.com',
          previewUrl: 'https://' + d.url,
          deployedAt: new Date(d.createdAt).toISOString(),
          branch: d.meta?.githubCommitRef,
          commit: (d.meta?.githubCommitMessage || '').split('\n')[0].slice(0, 100),
        };
      }
    }
  } catch (e) { out.webError = e.message; }

  res.json(out);
});

app.get('/api/goldbot-multi/all', async (_req, res) => {
  const ids = ['B1', 'B2', 'B3', 'B4'];
  const [liveResults, dailyResults] = await Promise.all([
    Promise.all(ids.map(id => fetchBotEndpoint(BOT_PORTS[id], '/live'))),
    Promise.all(ids.map(id => fetchBotEndpoint(BOT_PORTS[id], '/daily'))),
  ]);
  const bots = ids.map((id, i) => ({
    id,
    profile: BOT_PROFILES[id],
    port: BOT_PORTS[id],
    live: liveResults[i],
    daily: dailyResults[i],
  }));
  res.json({ bots, ts: new Date().toISOString() });
});
// Per-bot proxy — GET /api/goldbot-multi/:botId/:endpoint
app.get('/api/goldbot-multi/:botId/:endpoint(*)', async (req, res) => {
  const port = BOT_PORTS[req.params.botId];
  if (!port) return res.status(400).json({ error: 'Unknown bot ID' });
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  try {
    const data = await fetchBotEndpoint(port, '/' + req.params.endpoint + qs);
    if (data && data.error) return res.status(502).json(data);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GoldBot proxy
const GOLDBOT_URL = "http://127.0.0.1:8001";
app.get("/api/goldbot/:endpoint(*)", async (req, res) => {
  try {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const r = await fetch(GOLDBOT_URL + "/" + req.params.endpoint + qs);
    res.json(await r.json());
  } catch(e) { res.status(500).json({error: e.message}); }
});
// Multipart passthrough for CSV import (must be before generic POST proxy)
app.use("/api/goldbot/import-csv", createProxyMiddleware({
  target: GOLDBOT_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/goldbot/import-csv': '/import-csv' },
  on: { error: (err, req, res) => res.status(502).json({ error: err.message }) },
}));
app.post("/api/goldbot/:endpoint(*)", async (req, res) => {
  try {
    const r = await fetch(GOLDBOT_URL + "/" + req.params.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({error: e.message}); }
});



// Idea Factory — Airtable GET
app.get('/api/idea-factory', async (_req, res) => {
  if (!AIRTABLE_TOKEN) return res.status(503).json({ error: 'AIRTABLE_TOKEN not set', records: [] });
  try {
    const nodeFetch = require('node-fetch');
    const fetchFn = nodeFetch.default || nodeFetch;
    const fieldNames = ['Titel','Zusammenfassung','Status','Bewertung','Priorität','Kategorie','Projekt','Hebel','Relevanz','Umsetzung','Quelle'];
    const params = new URLSearchParams();
    params.set('maxRecords', '100');
    fieldNames.forEach(f => params.append('fields[]', f));
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_IDEAS_BASE + '/' + AIRTABLE_IDEAS_TABLE + '?' + params.toString();
    const r = await fetchFn(url, { headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN } });
    if (!r.ok) throw new Error('Airtable HTTP ' + r.status);
    const data = await r.json();
    const records = (data.records || []).map(rec => ({
      id: rec.id,
      title: rec.fields['Titel'] || '',
      summary: rec.fields['Zusammenfassung'] || '',
      status: rec.fields['Status'] || 'inbox',
      bewertung: rec.fields['Bewertung'] || '',
      prioritaet: rec.fields['Priorität'] || '',
      kategorie: rec.fields['Kategorie'] || '',
      projekt: rec.fields['Projekt'] || '',
      hebel: rec.fields['Hebel'] || '',
      relevanz: rec.fields['Relevanz'] || 0,
      umsetzung: rec.fields['Umsetzung'] || '',
      quelle: rec.fields['Quelle'] || '',
    }));
    res.json({ records, total: records.length });
  } catch (e) {
    res.status(500).json({ error: e.message, records: [] });
  }
});

// Idea Factory — POST new idea to Airtable
app.post('/api/idea-factory', async (req, res) => {
  if (!AIRTABLE_TOKEN) return res.status(503).json({ error: 'AIRTABLE_TOKEN not set' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const nodeFetch = require('node-fetch');
    const fetchFn = nodeFetch.default || nodeFetch;
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_IDEAS_BASE + '/' + AIRTABLE_IDEAS_TABLE;
    const r = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields: { Titel: text, Status: 'inbox', Quelle: 'LennoxOS Dashboard' } }] }),
    });
    if (!r.ok) throw new Error('Airtable HTTP ' + r.status);
    const data = await r.json();
    res.json({ ok: true, id: (data.records && data.records[0] && data.records[0].id) || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Personal OS — Profile
app.get('/api/personal/profile', (_req, res) => {
  try {
    const profilePath = '/home/carlos/personal-os/06-personal/agent-profile.md';
    const content = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf8') : '';
    // Extract habits section
    const habitsMatch = content.match(/## Habits[^#]*([\s\S]*?)(?=\n##|\n---|\n#[^#]|$)/);
    const habitsBlock = habitsMatch ? habitsMatch[0] : '';
    const habits = [];
    const habitLines = habitsBlock.split('\n').filter(l => /\*\*[^*]+\*\*/.test(l) && l.includes('|'));
    for (const line of habitLines) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const nameMatch = parts[0].match(/\*\*([^*]+)\*\*/);
        if (nameMatch) habits.push({ name: nameMatch[1], slot: parts[1] || '' });
      }
    }
    // Extract people map
    const peopleMatch = content.match(/## Personen-Map[^#]*([\s\S]*?)(?=\n##|\n---|\n#[^#]|$)/);
    const peopleBlock = peopleMatch ? peopleMatch[0] : '';
    const people = [];
    const peopleLines = peopleBlock.split('\n').filter(l => l.includes('|') && !l.includes('---') && !l.includes('Person'));
    for (const line of peopleLines) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const nameMatch = parts[0].match(/\*\*([^*]+)\*\*/);
        if (nameMatch) people.push({ name: nameMatch[1].split('(')[0].trim(), note: parts[0].split('(')[1]?.replace(')','').trim() || '', frequency: parts[1], channel: parts[2] });
      }
    }
    // Anti-drift rules
    const driftMatch = content.match(/## Anti-Drift-Rules[^#]*([\s\S]*?)(?=\n##|\n---|\n#[^#]|$)/);
    const driftBlock = driftMatch ? driftMatch[0] : '';
    const driftRules = driftBlock.split('\n').filter(l => /^\d\./.test(l.trim())).map(l => l.replace(/^\d\.\s*/, '').replace(/\*\*/g, '').trim());
    res.json({ habits, people, driftRules, raw: content });
  } catch (e) {
    res.status(500).json({ error: e.message, habits: [], people: [], driftRules: [] });
  }
});

// Personal OS — Finance (expenses.md)
app.get('/api/personal/finance', (_req, res) => {
  try {
    const expPath = '/home/carlos/personal-os/05-finance/expenses.md';
    const content = fs.existsSync(expPath) ? fs.readFileSync(expPath, 'utf8') : '';
    // Parse subscription table rows
    const subs = [];
    const lines = content.split('\n');
    let inTable = false;
    for (const line of lines) {
      if (line.includes('| Tool') || line.includes('| Plan')) { inTable = true; continue; }
      if (inTable && line.startsWith('|') && !line.includes('---')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 4 && !parts[0].includes('Tool')) {
          const name = parts[0].replace(/~~|\/\//g, '').trim();
          const plan = parts[1] || '';
          const cost = parts[2] || '';
          const renewal = parts[3] || '';
          const status = parts[4] || '';
          const active = !status.includes('Gekündigt') && !name.startsWith('~~');
          subs.push({ name: name.replace(/^~~(.+)~~$/, '$1'), plan, cost, renewal, active });
        }
      }
      if (inTable && !line.startsWith('|') && line.trim()) inTable = false;
    }
    // Parse burn rate summary
    const burnMatch = content.match(/## Burn-Rate[^#]*([\s\S]*?)(?=\n##|\n---|\n#|$)/);
    const burnBlock = burnMatch ? burnMatch[0] : '';
    const burnLines = burnBlock.split('\n').filter(l => l.includes('|') && !l.includes('---') && !l.includes('Szenario'));
    const burnRates = burnLines.map(l => {
      const parts = l.split('|').map(p => p.trim()).filter(Boolean);
      return parts.length >= 2 ? { label: parts[0].replace(/\*\*/g,''), value: parts[1].replace(/\*\*/g,'') } : null;
    }).filter(Boolean);
    res.json({ subscriptions: subs, burnRates, raw: content });
  } catch (e) {
    res.status(500).json({ error: e.message, subscriptions: [], burnRates: [] });
  }
});

// Personal OS — Habits tracking (read + write)
app.get('/api/personal/habits-log', (_req, res) => {
  const logPath = '/home/carlos/personal-os/06-personal/habits-log.json';
  try {
    const data = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {};
    res.json(data);
  } catch { res.json({}); }
});

app.post('/api/personal/habits-log', (req, res) => {
  const logPath = '/home/carlos/personal-os/06-personal/habits-log.json';
  try {
    const existing = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : {};
    const { date, habit, done } = req.body;
    if (!date || !habit) return res.status(400).json({ error: 'date + habit required' });
    if (!existing[date]) existing[date] = {};
    existing[date][habit] = done;
    fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
 * Personal OS — Landing Briefing Aggregator (30s cache)
 * Aggregates: tasks, calendar, inbox, aevum, system events.
 * Used by PersonalDashboard landing/home view.
 * ============================================================ */
const briefingCache = { ts: 0, data: null };
app.get('/api/personal/briefing', async (_req, res) => {
  if (Date.now() - briefingCache.ts < 30_000 && briefingCache.data) {
    return res.json({ ...briefingCache.data, cached: true });
  }
  const result = {
    tasks: { open: [], done: [], total: 0 },
    calendar: { events: [], error: null },
    inbox: { count: 0, preview: [], error: null },
    aevum: { customers: 0, audits: 0, helpbot: 0, error: null },
    updates: [],
    generatedAt: new Date().toISOString(),
  };

  // Tasks (sync, local file)
  try {
    const md = fs.existsSync('/home/carlos/personal-os/02-tasks/today.md')
      ? fs.readFileSync('/home/carlos/personal-os/02-tasks/today.md', 'utf8') : '';
    const lines = md.split('\n');
    result.tasks.open = lines.filter(l => /^\s*-\s*\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/, '').trim()).slice(0, 5);
    result.tasks.done = lines.filter(l => /^\s*-\s*\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, '').trim());
    result.tasks.total = result.tasks.open.length + result.tasks.done.length;
  } catch (e) { /* noop */ }

  // Parallel fetches: calendar, inbox, aevum
  const nf = require('node-fetch');
  const fetch = nf.default || nf;
  const PORT_LOCAL = process.env.PORT || 4000;
  const base = `http://127.0.0.1:${PORT_LOCAL}`;

  await Promise.allSettled([
    (async () => {
      try {
        const r = await fetch(`${base}/api/calendar/today`);
        const d = await r.json();
        result.calendar.events = (d.events || []).slice(0, 3);
        if (d.error) result.calendar.error = d.error;
      } catch (e) { result.calendar.error = e.message; }
    })(),
    (async () => {
      try {
        const r = await fetch(`${base}/api/gmail/inbox`);
        const d = await r.json();
        result.inbox.count = (d.messages || []).length;
        result.inbox.preview = (d.messages || []).slice(0, 2).map(m => ({
          from: (m.from || '').replace(/<.+>/, '').trim(),
          subject: m.subject || '',
        }));
        if (d.error) result.inbox.error = d.error;
      } catch (e) { result.inbox.error = e.message; }
    })(),
    (async () => {
      try {
        const r = await fetch(`${base}/api/aevum/aggregate`);
        const d = await r.json();
        result.aevum.customers = d.totalCustomers ?? d.customers?.length ?? 0;
        result.aevum.audits = d.recentAudits ?? d.audits ?? 0;
        result.aevum.helpbot = d.helpbotConversations ?? d.helpbot ?? 0;
        if (d.error) result.aevum.error = d.error;
      } catch (e) { result.aevum.error = e.message; }
    })(),
  ]);

  // Build "updates" timeline (last 24h activity)
  const updates = [];
  if (result.aevum.audits > 0) updates.push({ kind: 'aevum', label: `${result.aevum.audits} neue Audit-Submissions`, ts: 'heute' });
  if (result.aevum.helpbot > 0) updates.push({ kind: 'helpbot', label: `${result.aevum.helpbot} Helpbot-Konversationen`, ts: 'heute' });
  if (result.inbox.count > 0) updates.push({ kind: 'mail', label: `${result.inbox.count} ungelesene Mails`, ts: 'jetzt' });
  if (result.tasks.done.length > 0) updates.push({ kind: 'task', label: `${result.tasks.done.length} Tasks erledigt`, ts: 'heute' });
  result.updates = updates;

  briefingCache.ts = Date.now();
  briefingCache.data = result;
  res.json(result);
});


// Gmail + Calendar — OAuth2 helper
async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) throw new Error('Google credentials missing in .env');
  const nf = require('node-fetch');
  const fetch = nf.default || nf;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(data));
  return data.access_token;
}

// GET /api/gmail/inbox — last 15 unread messages
app.get('/api/gmail/inbox', async (_req, res) => {
  try {
    const nf = require('node-fetch');
    const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    // list unread message IDs
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=is:unread',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];
    // fetch each message (parallel, metadata only)
    const details = await Promise.all(messages.map(async ({ id }) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await r.json();
      const headers = {};
      (d.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      return {
        id,
        subject: headers['Subject'] || '(kein Betreff)',
        from: headers['From'] || '',
        date: headers['Date'] || '',
        snippet: d.snippet || '',
        labelIds: d.labelIds || [],
      };
    }));
    res.json({ messages: details });
  } catch (e) {
    res.status(500).json({ error: e.message, messages: [] });
  }
});

// GET /api/calendar/today — events for next 7 days
app.get('/api/calendar/today', async (_req, res) => {
  try {
    const nf = require('node-fetch');
    const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    const events = (data.items || []).map(e => ({
      id: e.id,
      summary: e.summary || '(kein Titel)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      description: (e.description || '').slice(0, 200),
    }));
    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message, events: [] });
  }
});


// GET /api/gmail/inbox2 — carloswrusch97@gmail.com (second account)
app.get('/api/gmail/inbox2', async (_req, res) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN_2 } = process.env;
    if (!GOOGLE_REFRESH_TOKEN_2) return res.json({ messages: [], note: 'GOOGLE_REFRESH_TOKEN_2 not set' });
    const nf = require('node-fetch');
    const fetch = nf.default || nf;
    // get access token for second account
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN_2,
        grant_type: 'refresh_token',
      }),
    });
    const td = await tr.json();
    if (!td.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(td));
    const token = td.access_token;
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=is:unread',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const messages = listData.messages || [];
    const details = await Promise.all(messages.map(async ({ id }) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await r.json();
      const headers = {};
      (d.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      return {
        id,
        subject: headers['Subject'] || '(kein Betreff)',
        from: headers['From'] || '',
        date: headers['Date'] || '',
        snippet: d.snippet || '',
        labelIds: d.labelIds || [],
      };
    }));
    res.json({ messages: details });
  } catch (e) {
    res.status(500).json({ error: e.message, messages: [] });
  }
});

// GET /api/gmail/threads2?q=&maxResults=50 — Account 2 thread list
app.get('/api/gmail/threads2', async (req, res) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN_2 } = process.env;
    if (!GOOGLE_REFRESH_TOKEN_2) return res.json({ threads: [], note: 'GOOGLE_REFRESH_TOKEN_2 not set' });
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: GOOGLE_REFRESH_TOKEN_2, grant_type: 'refresh_token' }),
    });
    const td = await tr.json();
    if (!td.access_token) throw new Error('Token refresh failed: ' + JSON.stringify(td));
    const token = td.access_token;
    const q = req.query.q || 'in:inbox';
    const maxResults = Math.min(parseInt(req.query.maxResults) || 20, 50);
    const pageToken = req.query.pageToken ? '&pageToken=' + req.query.pageToken : '';
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&q=${encodeURIComponent(q)}${pageToken}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const threadIds = (listData.threads || []).map(t => t.id);
    const threads = await Promise.all(threadIds.map(async (id) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await r.json();
      const first = d.messages?.[0];
      const headers = {};
      (first?.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      const unread = (first?.labelIds || []).includes('UNREAD');
      return { id, subject: headers['Subject'] || '(kein Betreff)', from: headers['From'] || '', date: headers['Date'] || '', snippet: first?.snippet || '', unread, messageCount: d.messages?.length || 1 };
    }));
    res.json({ threads, nextPageToken: listData.nextPageToken || null });
  } catch (e) { res.status(500).json({ error: e.message, threads: [] }); }
});

// GET /api/gmail/thread2/:id — Account 2 full thread detail
app.get('/api/gmail/thread2/:id', async (req, res) => {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN_2 } = process.env;
    if (!GOOGLE_REFRESH_TOKEN_2) return res.status(400).json({ error: 'GOOGLE_REFRESH_TOKEN_2 not set' });
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: GOOGLE_REFRESH_TOKEN_2, grant_type: 'refresh_token' }),
    });
    const td = await tr.json();
    if (!td.access_token) throw new Error('Token refresh failed');
    const token = td.access_token;
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${req.params.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    function decodeBody(payload) {
      if (payload.body?.data) return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
      if (payload.parts) { for (const p of payload.parts) { if (p.mimeType === 'text/html') { const b = decodeBody(p); if (b) return b; } } for (const p of payload.parts) { if (p.mimeType === 'text/plain') { const b = decodeBody(p); if (b) return b; } } for (const p of payload.parts) { const b = decodeBody(p); if (b) return b; } }
      return '';
    }
    const messages = (data.messages || []).map(m => {
      const headers = {}; (m.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      return { id: m.id, from: headers['From'] || '', to: headers['To'] || '', date: headers['Date'] || '', subject: headers['Subject'] || '', snippet: m.snippet || '', body: decodeBody(m.payload || {}), labelIds: m.labelIds || [] };
    });
    res.json({ id: req.params.id, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gmail/labels — list user labels
app.get('/api/gmail/labels', async (_req, res) => {
  try {
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    res.json({ labels: data.labels || [] });
  } catch (e) { res.status(500).json({ error: e.message, labels: [] }); }
});

// GET /api/gmail/threads?q=&maxResults=20 — thread list
app.get('/api/gmail/threads', async (req, res) => {
  try {
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    const q = req.query.q || 'in:inbox';
    const maxResults = Math.min(parseInt(req.query.maxResults) || 20, 50);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const threads = listData.threads || [];
    // fetch snippet + subject for each thread
    const details = await Promise.all(threads.map(async ({ id }) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await r.json();
      const msg = (d.messages || [])[0] || {};
      const lastMsg = (d.messages || []).slice(-1)[0] || {};
      const headers = {};
      (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      const lastHeaders = {};
      (lastMsg.payload?.headers || []).forEach(h => { lastHeaders[h.name] = h.value; });
      return {
        id,
        subject: headers['Subject'] || '(kein Betreff)',
        from: headers['From'] || '',
        date: lastHeaders['Date'] || headers['Date'] || '',
        snippet: lastMsg.snippet || msg.snippet || '',
        labelIds: msg.labelIds || [],
        messageCount: (d.messages || []).length,
        unread: (msg.labelIds || []).includes('UNREAD'),
      };
    }));
    res.json({ threads: details });
  } catch (e) { res.status(500).json({ error: e.message, threads: [] }); }
});

// GET /api/gmail/thread/:id — full thread with decoded bodies
app.get('/api/gmail/thread/:id', async (req, res) => {
  try {
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${req.params.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    function decodeBody(payload) {
      if (!payload) return '';
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
      }
      if (payload.parts) {
        // prefer text/html, fallback text/plain
        const html = payload.parts.find(p => p.mimeType === 'text/html');
        if (html?.body?.data) return Buffer.from(html.body.data, 'base64url').toString('utf-8');
        const plain = payload.parts.find(p => p.mimeType === 'text/plain');
        if (plain?.body?.data) return Buffer.from(plain.body.data, 'base64url').toString('utf-8');
        // recurse multipart
        for (const part of payload.parts) {
          const body = decodeBody(part);
          if (body) return body;
        }
      }
      return '';
    }
    const messages = (data.messages || []).map(msg => {
      const headers = {};
      (msg.payload?.headers || []).forEach(h => { headers[h.name] = h.value; });
      return {
        id: msg.id,
        subject: headers['Subject'] || '',
        from: headers['From'] || '',
        to: headers['To'] || '',
        date: headers['Date'] || '',
        body: decodeBody(msg.payload),
        labelIds: msg.labelIds || [],
        snippet: msg.snippet || '',
      };
    });
    res.json({ id: req.params.id, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gmail/mark-read/:id — mark message as read
app.post('/api/gmail/mark-read/:id', async (req, res) => {
  try {
    const nf = require('node-fetch'); const fetch = nf.default || nf;
    const token = await getGoogleAccessToken();
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${req.params.id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



function loginHtml(dashboard, error='') {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${dashboard} — Login</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;color:#e2e8f0;font-family:'Inter',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#1a1d27;border:1px solid #2a2d3a;border-radius:16px;padding:40px;width:100%;max-width:380px}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:32px}
  .logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#22d3ee,#3b82f6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
  .logo h1{font-size:18px;font-weight:600;color:#fff}
  .logo p{font-size:12px;color:#64748b;margin-top:2px}
  label{display:block;font-size:12px;font-weight:500;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
  input{width:100%;background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:14px;outline:none;transition:border-color .2s}
  input:focus{border-color:#22d3ee}
  .field{margin-bottom:20px}
  .btn{width:100%;background:#22d3ee;color:#0f1117;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s;margin-top:4px}
  .btn:hover{opacity:.9}
  .error{background:#7f1d1d33;border:1px solid #ef444444;border-radius:8px;padding:10px 14px;font-size:13px;color:#fca5a5;margin-bottom:20px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-icon">⚡</div>
    <div><h1>${dashboard}</h1><p>OS Dashboard</p></div>
  </div>
  ${error ? '<div class="error">' + error + '</div>' : ''}
  <form method="POST" action="/auth/login">
    <div class="field"><label>Benutzername</label><input type="text" name="username" autocomplete="username" autofocus required></div>
    <div class="field"><label>Passwort</label><input type="password" name="password" autocomplete="current-password" required></div>
    <input type="hidden" name="_dashboard" value="${dashboard}">
    <button class="btn" type="submit">Anmelden</button>
  </form>
</div>
</body></html>`;
}

function changePwHtml(dashboard, token, error='') {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Passwort ändern</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;color:#e2e8f0;font-family:'Inter',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .card{background:#1a1d27;border:1px solid #2a2d3a;border-radius:16px;padding:40px;width:100%;max-width:380px}
  h1{font-size:18px;font-weight:600;margin-bottom:8px}
  p{font-size:13px;color:#64748b;margin-bottom:28px}
  label{display:block;font-size:12px;font-weight:500;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
  input{width:100%;background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:14px;outline:none}
  input:focus{border-color:#22d3ee}
  .field{margin-bottom:20px}
  .btn{width:100%;background:#22d3ee;color:#0f1117;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer}
  .error{background:#7f1d1d33;border:1px solid #ef444444;border-radius:8px;padding:10px 14px;font-size:13px;color:#fca5a5;margin-bottom:20px}
</style>
</head>
<body>
<div class="card">
  <h1>Passwort festlegen</h1>
  <p>Erstanmeldung — bitte ein persönliches Passwort wählen.</p>
  ${error ? '<div class="error">' + error + '</div>' : ''}
  <form method="POST" action="/auth/change-password">
    <input type="hidden" name="_token" value="${token}">
    <div class="field"><label>Neues Passwort</label><input type="password" name="new_pw" minlength="8" required></div>
    <div class="field"><label>Wiederholen</label><input type="password" name="confirm_pw" minlength="8" required></div>
    <button class="btn" type="submit">Speichern & Einloggen</button>
  </form>
</div>
</body></html>`;
}

// ─── Auth routes (used by all dashboards) ────────────────────────────────────
app.use(express.urlencoded({ extended: false }));

// Verify token — called by other dashboards internally
app.post('/api/auth/verify', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ ok: false });
  const payload = auth.verifyToken(token);
  if (!payload) return res.json({ ok: false });
  res.json({ ok: true, ...payload });
});

// POST /auth/login — handles login for any dashboard (browser form OR JSON API)
app.post('/auth/login', async (req, res) => {
  const { username, password, _dashboard } = req.body;
  const dashboard = _dashboard || 'lennox';
  const isApi = req.is('json');
  try {
    const user = await auth.findUser(authPool, dashboard, username);
    if (!user || !(await auth.verifyPassword(password, user.password_hash))) {
      if (isApi) return res.status(401).json({ ok: false, error: 'Falscher Benutzername oder Passwort' });
      return res.send(loginHtml(dashboard, 'Falscher Benutzername oder Passwort'));
    }
    await authPool.query('UPDATE dashboard_users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = auth.createToken(user.id, user.username, dashboard);
    if (isApi) {
      return res.json({ ok: true, token, must_change_pw: user.must_change_pw || false });
    }
    res.cookie(auth.COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: auth.TOKEN_TTL_MS, domain: '.lennoxos.com', secure: true });
    if (user.must_change_pw) return res.redirect('/auth/change-password');
    res.redirect('/');
  } catch (e) {
    if (isApi) return res.status(500).json({ ok: false, error: e.message });
    res.send(loginHtml(dashboard, 'Serverfehler: ' + e.message));
  }
});

// GET /auth/change-password — show form
app.get('/auth/change-password', (req, res) => {
  const token = req.cookies?.[auth.COOKIE_NAME] || '';
  const payload = auth.verifyToken(token);
  if (!payload) return res.redirect('/login');
  res.send(changePwHtml(payload.dashboard, token));
});

// POST /auth/change-password
app.post('/auth/change-password', async (req, res) => {
  const { _token, new_pw, confirm_pw } = req.body;
  const isApi = req.is('json');
  const payload = auth.verifyToken(_token || req.cookies?.[auth.COOKIE_NAME] || '');
  if (!payload) {
    if (isApi) return res.status(401).json({ ok: false, error: 'Invalid token' });
    return res.redirect('/login');
  }
  if (new_pw !== confirm_pw) {
    if (isApi) return res.status(400).json({ ok: false, error: 'Passwörter stimmen nicht überein' });
    return res.send(changePwHtml(payload.dashboard, _token, 'Passwörter stimmen nicht überein'));
  }
  if (new_pw.length < 8) {
    if (isApi) return res.status(400).json({ ok: false, error: 'Mindestens 8 Zeichen' });
    return res.send(changePwHtml(payload.dashboard, _token, 'Mindestens 8 Zeichen'));
  }
  try {
    await auth.updatePassword(authPool, payload.userId, new_pw);
    const newToken = auth.createToken(payload.userId, payload.username, payload.dashboard);
    if (isApi) return res.json({ ok: true, token: newToken });
    res.cookie(auth.COOKIE_NAME, newToken, { httpOnly: true, sameSite: 'lax', maxAge: auth.TOKEN_TTL_MS, domain: '.lennoxos.com', secure: true });
    res.redirect('/');
  } catch (e) {
    if (isApi) return res.status(500).json({ ok: false, error: e.message });
    res.send(changePwHtml(payload.dashboard, _token, 'Fehler: ' + e.message));
  }
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  res.clearCookie(auth.COOKIE_NAME);
  res.redirect('/login');
});

// ─── User management API (admin only, lennox-os internal) ───────────────────
// Uses earlier requireLennoxAuth (with isLennoxInternal bypass)

app.get('/api/users', requireLennoxAuth, async (req, res) => {
  const { dashboard } = req.query;
  try {
    const users = await auth.listUsers(authPool, dashboard || null);
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireLennoxAuth, async (req, res) => {
  const { dashboard, username, password } = req.body;
  if (!dashboard || !username || !password) return res.status(400).json({ error: 'dashboard/username/password required' });
  try {
    const user = await auth.createUser(authPool, dashboard, username, password, true);
    res.json({ ok: true, id: user.id, username: user.username, dashboard: user.dashboard, must_change_pw: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'User already exists' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/users/:id', requireLennoxAuth, async (req, res) => {
  try {
    await auth.deleteUser(authPool, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/reset-password', requireLennoxAuth, async (req, res) => {
  const { temp_password } = req.body;
  if (!temp_password) return res.status(400).json({ error: 'temp_password required' });
  try {
    await auth.resetPassword(authPool, req.params.id, temp_password);
    res.json({ ok: true, must_change_pw: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /login — serve login page for lennox-os itself
app.get('/login', (req, res) => {
  const token = req.cookies?.[auth.COOKIE_NAME];
  if (auth.verifyToken(token || '')) return res.redirect('/');
  res.send(loginHtml('lennox'));
});

// ─── AEVUM Customers Aggregate (proxy) ─────────────────────────────────────
// Forwards to api.aevum-system.de/api/accounts/aggregate using admin token from env.
// Token never reaches the browser. 60s in-memory cache.
const aevumAggCache = { ts: 0, data: null, status: 200 };
app.get('/api/aevum/aggregate', async (_req, res) => {
  if (Date.now() - aevumAggCache.ts < 60_000 && aevumAggCache.data) {
    return res.status(aevumAggCache.status).json({ ...aevumAggCache.data, cached: true });
  }
  const token = process.env.AEVUM_ADMIN_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'AEVUM_ADMIN_TOKEN not configured' });
  }
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://api.lennoxos.com/api/accounts/aggregate', {
      headers: { 'x-aevum-admin-token': token, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(tm);
    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    aevumAggCache.ts = Date.now();
    aevumAggCache.data = body;
    aevumAggCache.status = r.status;
    res.status(r.status).json(body);
  } catch (e) {
    res.status(502).json({ error: 'AEVUM aggregate fetch failed', detail: e.message });
  }
});

// ─── Sub-OS Health (Wave E3) ─────────────────────────────────────────────
// Forwards to aevum-api /api/sub-os/_all/summary. 60s cache. Token never exposed.
const subOsHealthCache = { ts: 0, data: null, status: 200 };
app.get('/api/aevum/sub-os', async (_req, res) => {
  if (Date.now() - subOsHealthCache.ts < 60_000 && subOsHealthCache.data) {
    return res.status(subOsHealthCache.status).json({ ...subOsHealthCache.data, cached: true });
  }
  const token = process.env.AEVUM_ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'AEVUM_ADMIN_TOKEN not configured' });
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch('https://api.lennoxos.com/api/sub-os/_all/summary', {
      headers: { 'x-aevum-admin-token': token, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(tm);
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
    subOsHealthCache.ts = Date.now();
    subOsHealthCache.data = body;
    subOsHealthCache.status = r.status;
    res.status(r.status).json(body);
  } catch (e) {
    res.status(502).json({ error: 'sub-os fetch failed', detail: e.message });
  }
});

// ─── Activity Dashboard (Claude/Vendor/Stripe) ─────────────────────────────
const { createClient: createSb } = require('@supabase/supabase-js');
const _sbAct = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createSb(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function sbOr503(res) {
  if (!_sbAct) { res.status(503).json({ error: 'Supabase not configured' }); return null; }
  return _sbAct;
}

app.get('/api/activity/summary', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const d7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    async function range(from) {
      const { data, error } = await sb.from('claude_usage_daily')
        .select('input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,message_count,tool_calls,effective_cost_usd')
        .gte('day', from);
      if (error) throw error;
      const sum = data.reduce((a, r) => ({
        input: a.input + Number(r.input_tokens || 0),
        output: a.output + Number(r.output_tokens || 0),
        cache_creation: a.cache_creation + Number(r.cache_creation_tokens || 0),
        cache_read: a.cache_read + Number(r.cache_read_tokens || 0),
        messages: a.messages + Number(r.message_count || 0),
        tool_calls: a.tool_calls + Number(r.tool_calls || 0),
        cost_usd: a.cost_usd + Number(r.effective_cost_usd || 0),
      }), { input: 0, output: 0, cache_creation: 0, cache_read: 0, messages: 0, tool_calls: 0, cost_usd: 0 });
      sum.total_tokens = sum.input + sum.output + sum.cache_creation + sum.cache_read;
      sum.cost_usd = +sum.cost_usd.toFixed(2);
      return sum;
    }
    const [sessTotal, syncRuns] = await Promise.all([
      sb.from('claude_sessions').select('session_id', { count: 'exact', head: true }),
      sb.from('activity_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);
    const [t, w, m] = await Promise.all([range(today), range(d7), range(d30)]);
    res.json({ today: t, last_7d: w, last_30d: m, sessions_total: sessTotal.count || 0, recent_syncs: syncRuns.data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/daily', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await sb.from('claude_usage_daily')
      .select('day,model,project_slug,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,message_count,tool_calls,effective_cost_usd')
      .gte('day', from).order('day', { ascending: true });
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/breakdown', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await sb.from('claude_usage_daily')
      .select('model,project_slug,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,message_count,tool_calls,effective_cost_usd')
      .gte('day', from);
    if (error) throw error;
    const byModel = {}, byProject = {};
    for (const r of data || []) {
      const tot = Number(r.input_tokens) + Number(r.output_tokens) + Number(r.cache_creation_tokens) + Number(r.cache_read_tokens);
      const cost = Number(r.effective_cost_usd || 0);
      const msgs = Number(r.message_count || 0);
      byModel[r.model] = byModel[r.model] || { model: r.model, tokens: 0, cost: 0, messages: 0 };
      byModel[r.model].tokens += tot; byModel[r.model].cost += cost; byModel[r.model].messages += msgs;
      const p = r.project_slug || 'unknown';
      byProject[p] = byProject[p] || { project_slug: p, tokens: 0, cost: 0, messages: 0 };
      byProject[p].tokens += tot; byProject[p].cost += cost; byProject[p].messages += msgs;
    }
    const sortByCost = (a, b) => b.cost - a.cost;
    res.json({
      by_model:   Object.values(byModel).map(r => ({ ...r, cost: +r.cost.toFixed(2) })).sort(sortByCost),
      by_project: Object.values(byProject).map(r => ({ ...r, cost: +r.cost.toFixed(2) })).sort(sortByCost),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/sessions', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const { data, error } = await sb.from('claude_sessions')
      .select('session_id,project_path,project_slug,last_seen_at,first_seen_at,message_count,total_input_tokens,total_output_tokens,total_cache_creation_tokens,total_cache_read_tokens,total_tool_calls,models_used')
      .order('last_seen_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/vendors', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await sb.from('vendor_usage_daily').select('*').gte('day', from).order('day', { ascending: false });
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/subscriptions', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data, error } = await sb.from('stripe_subscriptions')
      .select('stripe_id,customer_id,product_name,price_nickname,amount_cents,currency,interval,status,current_period_start,current_period_end,cancel_at_period_end')
      .order('current_period_end', { ascending: false, nullsFirst: false });
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activity/payments', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const { data, error } = await sb.from('stripe_payments')
      .select('stripe_id,amount_cents,currency,status,description,created_at,subscription_id')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendor-Metrics (Infra/AI/Automation/Marketing)
app.get('/api/activity/metrics', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await sb.from('vendor_metrics_daily').select('*').gte('day', from).order('day', { ascending: false });
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Missing API-Keys (Tracking-list)
app.get('/api/activity/missing-keys', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data, error } = await sb.from('missing_api_keys').select('*').order('vendor').order('needed_key');
    if (error) throw error;
    res.json({ rows: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Finance Overview Aggregator ──────────────────────────────────────────
// Konsolidiert: claude_usage_daily + vendor_usage_daily + vendor_metrics_daily
// + personal-os/05-finance/expenses.md + stripe_payments
// in 4 Buckets: projects / infra / private / revenue
//
// Klassifikation:
//   - Claude-tokens & vercel-projects → project_slug or project_name → projects bucket
//   - Hetzner servers / Cloudflare zones / OpenRouter total / Anthropic-Max-Equivalent → infra bucket
//   - Personal-OS-expenses.md subscriptions → private bucket
//   - Stripe-incoming payments+subs → revenue bucket
const PROJECT_SLUGS = ['aevum', 'gts', 'utilityhub', 'ketolabs', 'thailand', 'k3ngama', 'betterfly', 'paperclip'];
const INFRA_SLUGS   = ['lennox', 'lennoxos', 'personal-os', 'home', 'unknown'];

function classifyVendorScope(vendor, scope) {
  const s = (scope || '').toLowerCase();
  // Cloudflare zones / Vercel projects / Hetzner servers — match against project slugs
  for (const slug of PROJECT_SLUGS) {
    if (s.includes(slug)) return { bucket: 'projects', project: slug };
  }
  // Infra defaults
  if (vendor === 'hetzner') return { bucket: 'infra', project: 'lennoxos' };
  if (vendor === 'cloudflare' && (s.includes('lennoxos') || s === '')) return { bucket: 'infra', project: 'lennoxos' };
  if (vendor === 'vercel' && (s === '' || s.includes('lennox'))) return { bucket: 'infra', project: 'lennoxos' };
  // Default: infra-ish for system vendors
  if (['vercel', 'cloudflare', 'hetzner', 'github'].includes(vendor)) return { bucket: 'infra', project: 'lennoxos' };
  // AI/Marketing tools without scope → infra (shared)
  return { bucket: 'infra', project: 'shared' };
}

app.get('/api/finance/overview', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const d7  = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);

    const [claude30d, vendors30d, metrics30d, pay30d, subs] = await Promise.all([
      sb.from('claude_usage_daily').select('day,project_slug,model,effective_cost_usd,message_count').gte('day', d30),
      sb.from('vendor_usage_daily').select('day,vendor,model,cost_usd,request_count').gte('day', d30),
      sb.from('vendor_metrics_daily').select('day,vendor,metric_name,scope,value,unit,cost_usd').gte('day', d30),
      sb.from('stripe_payments').select('amount_cents,currency,status,created_at').gte('created_at', d30 + 'T00:00:00Z'),
      sb.from('stripe_subscriptions').select('amount_cents,currency,interval,status'),
    ]);

    // ---- BUCKET: projects (from claude_usage_daily + classified vendor metrics)
    const projects = {};
    function projAdd(slug, cost, source) {
      if (!projects[slug]) projects[slug] = { project: slug, cost_30d: 0, sources: {} };
      projects[slug].cost_30d += cost;
      projects[slug].sources[source] = (projects[slug].sources[source] || 0) + cost;
    }
    for (const r of claude30d.data || []) {
      const slug = PROJECT_SLUGS.includes(r.project_slug) ? r.project_slug : null;
      const cost = Number(r.effective_cost_usd || 0);
      if (slug) projAdd(slug, cost, 'claude');
    }

    // ---- BUCKET: infra (hetzner, cf, vercel, openrouter, github)
    let infra = { servers_eur: 0, cdn_zones: 0, deploys_count: 0, llm_apis_usd: 0, claude_unassigned_usd: 0, items: [] };

    for (const r of metrics30d.data || []) {
      const cls = classifyVendorScope(r.vendor, r.scope);
      const cost_usd = Number(r.cost_usd || 0);
      const val = Number(r.value || 0);

      if (cls.bucket === 'projects') {
        if (cost_usd) projAdd(cls.project, cost_usd, r.vendor);
      } else {
        // infra
        if (r.vendor === 'hetzner' && r.metric_name === 'total_monthly_cost_eur') {
          infra.servers_eur += val;
        } else if (r.vendor === 'cloudflare' && r.metric_name === 'zones_total') {
          infra.cdn_zones = val;
        } else if (r.vendor === 'vercel' && r.metric_name === 'deployments_recent') {
          infra.deploys_count = val;
        }
        if (cost_usd) infra.items.push({ vendor: r.vendor, metric: r.metric_name, scope: r.scope, cost_usd, day: r.day });
      }
    }
    for (const r of vendors30d.data || []) {
      infra.llm_apis_usd += Number(r.cost_usd || 0);
    }
    // Claude unassigned project (home/unknown/lennox/etc.)
    for (const r of claude30d.data || []) {
      if (!PROJECT_SLUGS.includes(r.project_slug)) {
        infra.claude_unassigned_usd += Number(r.effective_cost_usd || 0);
      }
    }

    // ---- BUCKET: private (parse personal-os/05-finance/expenses.md)
    let priv = { subscriptions: [], total_monthly_eur: 0 };
    try {
      const expPath = '/home/carlos/personal-os/05-finance/expenses.md';
      if (fs.existsSync(expPath)) {
        const content = fs.readFileSync(expPath, 'utf8');
        const lines = content.split('\n');
        let inTable = false;
        for (const line of lines) {
          if (line.includes('| Tool') || line.includes('| Plan')) { inTable = true; continue; }
          if (inTable && line.startsWith('|') && !line.includes('---')) {
            const parts = line.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 3 && !parts[0].includes('Tool')) {
              const name = parts[0].replace(/~~|\/\//g, '').trim();
              const plan = parts[1] || '';
              const costStr = parts[2] || '';
              const renewal = parts[3] || '';
              const status = parts[4] || '';
              const active = !status.toLowerCase().includes('gekündigt') && !parts[0].startsWith('~~');
              // try parse cost €X / mo
              const m = costStr.match(/(\d+[,.]?\d*)/);
              const cost_eur = m ? parseFloat(m[1].replace(',', '.')) : 0;
              priv.subscriptions.push({ name, plan, cost_str: costStr, cost_eur, renewal, active });
              if (active) priv.total_monthly_eur += cost_eur;
            }
          }
          if (inTable && !line.startsWith('|') && line.trim()) inTable = false;
        }
      }
    } catch {}

    // ---- BUCKET: revenue (Stripe incoming)
    const revenue = {
      payments_30d: (pay30d.data || []).filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount_cents / 100, 0),
      payments_count: (pay30d.data || []).length,
      active_subs_monthly: (subs.data || []).filter(s => s.status === 'active').reduce((s, x) => {
        const m = x.interval === 'year' ? x.amount_cents / 12 : x.amount_cents;
        return s + m / 100;
      }, 0),
    };

    // ---- Summary KPIs
    const totalProjectCost = Object.values(projects).reduce((s, p) => s + p.cost_30d, 0);
    const totalInfraUsd = (infra.servers_eur * 1.08) + infra.llm_apis_usd + infra.claude_unassigned_usd;

    res.json({
      window_days: 30,
      buckets: {
        projects: Object.values(projects).sort((a, b) => b.cost_30d - a.cost_30d),
        infra,
        private: priv,
        revenue,
      },
      kpi: {
        projects_cost_30d_usd: +totalProjectCost.toFixed(2),
        infra_cost_30d_usd:    +totalInfraUsd.toFixed(2),
        private_monthly_eur:   +priv.total_monthly_eur.toFixed(2),
        revenue_30d_eur:       +revenue.payments_30d.toFixed(2),
        net_30d_estimate_usd:  +(revenue.payments_30d * 1.08 - totalProjectCost - totalInfraUsd - priv.total_monthly_eur * 1.08).toFixed(2),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Subscriptions Inventory + Project-Allocation ─────────────────────────
app.get('/api/finance/subscriptions', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data: subs, error: e1 } = await sb.from('subscriptions').select('*').order('vendor');
    if (e1) throw e1;
    const { data: uses, error: e2 } = await sb.from('project_subscription_uses').select('*');
    if (e2) throw e2;
    // attach uses per subscription
    const byId = {};
    for (const u of uses || []) {
      (byId[u.subscription_id] = byId[u.subscription_id] || []).push(u);
    }
    res.json({
      subscriptions: (subs || []).map(s => ({ ...s, uses: byId[s.id] || [] })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/finance/subscriptions/:id', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const allowed = ['vendor', 'product_name', 'plan', 'amount_cents', 'currency', 'interval', 'status', 'account_source', 'category', 'vendor_url', 'notes'];
    const upd = {};
    for (const k of allowed) if (k in req.body) upd[k] = req.body[k];
    upd.updated_at = new Date().toISOString();
    const { error } = await sb.from('subscriptions').update(upd).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/finance/subscriptions', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { vendor, product_name, plan, amount_cents, currency, interval, account_source, category, notes } = req.body;
    if (!vendor || !product_name) return res.status(400).json({ error: 'vendor + product_name required' });
    const { data, error } = await sb.from('subscriptions').insert({
      vendor, product_name, plan: plan || null,
      amount_cents: amount_cents || 0, currency: (currency || 'eur').toLowerCase(),
      interval: interval || 'month', status: 'active',
      account_source: account_source || 'manual',
      source: 'manual', category: category || null, notes: notes || null,
    }).select('id').single();
    if (error) throw error;
    res.json({ ok: true, id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/finance/subscriptions/:id', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { error } = await sb.from('subscriptions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Toggle "project uses this sub" — add/remove allocation
app.post('/api/finance/subscriptions/:id/allocate', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const subId = parseInt(req.params.id);
    const { project_slug, billable } = req.body;
    if (!project_slug) return res.status(400).json({ error: 'project_slug required' });
    const { data: existing } = await sb.from('project_subscription_uses')
      .select('id,billable').eq('subscription_id', subId).eq('project_slug', project_slug).maybeSingle();
    if (existing) {
      if (billable === false || billable === true) {
        await sb.from('project_subscription_uses').update({ billable }).eq('id', existing.id);
      } else {
        await sb.from('project_subscription_uses').delete().eq('id', existing.id);
      }
    } else {
      await sb.from('project_subscription_uses').insert({
        subscription_id: subId, project_slug,
        billable: billable !== false,
        in_use_since: new Date().toISOString().slice(0, 10),
      });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Invoice-Preview for a specific customer/project
app.get('/api/finance/invoice/:project_slug', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const slug = req.params.project_slug;
    const period_days = Math.min(parseInt(req.query.days) || 30, 365);
    const fromDate = new Date(Date.now() - period_days * 86400000).toISOString().slice(0, 10);

    // 1) All subscriptions where this project is listed as "uses"
    const { data: uses } = await sb.from('project_subscription_uses')
      .select('billable, subscription:subscriptions(*)')
      .eq('project_slug', slug);
    const subLines = (uses || [])
      .filter(u => u.billable && u.subscription)
      .map(u => {
        const s = u.subscription;
        // Tool-Reselling: full subscription cost per period (proportional if days != cycle)
        let monthlyCost = s.amount_cents;
        if (s.interval === 'year') monthlyCost = s.amount_cents / 12;
        if (s.interval === 'usage') monthlyCost = 0;
        const periodCost = (monthlyCost / 30) * period_days;
        return {
          kind: 'subscription',
          subscription_id: s.id,
          vendor: s.vendor,
          product_name: s.product_name,
          plan: s.plan,
          unit_cost_cents: s.amount_cents,
          currency: s.currency,
          interval: s.interval,
          period_cost_eur: +(periodCost / 100).toFixed(2),
          note: `Tool-Reselling: voller Abo-Preis (Carlos zahlt fix, ${slug} nutzt es)`,
        };
      });

    // 2) Claude-API token cost from claude_usage_daily
    const { data: claude } = await sb.from('claude_usage_daily')
      .select('day,model,effective_cost_usd,message_count,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens')
      .eq('project_slug', slug).gte('day', fromDate);
    const claudeUsd = (claude || []).reduce((s, r) => s + Number(r.effective_cost_usd || 0), 0);
    const claudeMsgs = (claude || []).reduce((s, r) => s + Number(r.message_count || 0), 0);
    const claudeLine = claudeUsd > 0 ? {
      kind: 'api',
      vendor: 'anthropic',
      product_name: 'Claude API (token usage)',
      period_cost_eur: +(claudeUsd / 1.08).toFixed(2),  // USD→EUR rough
      raw_cost_usd: +claudeUsd.toFixed(2),
      currency: 'eur',
      note: `Pass-through: ${claudeMsgs} messages über ${claude.length} Tage`,
    } : null;

    const lines = [...subLines];
    if (claudeLine) lines.push(claudeLine);
    const total_eur = +lines.reduce((s, l) => s + l.period_cost_eur, 0).toFixed(2);

    res.json({
      project_slug: slug,
      period_days,
      from_date: fromDate,
      to_date: new Date().toISOString().slice(0, 10),
      lines,
      total_eur,
      meta: {
        subscription_count: subLines.length,
        claude_tracked: !!claudeLine,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/activity/sync/:source', (req, res) => {
  const valid = {
    claude: 'claude-jsonl-parser.js', vendors: 'vendor-sync.js', stripe: 'stripe-sync.js',
    infra: 'infra-sync.js', ai: 'ai-sync.js', automation: 'automation-sync.js', marketing: 'marketing-sync.js',
    'seed-subs': 'seed-subscriptions.js', 'email-scan': 'email-receipt-scanner.js',
  };
  const script = valid[req.params.source];
  if (!script) return res.status(400).json({ error: 'invalid source' });
  const { spawn } = require('child_process');
  const child = spawn('node', [script], {
    cwd: '/home/carlos/lennox-os/services/activity-sync',
    detached: true, stdio: 'ignore',
  });
  child.unref();
  res.json({ ok: true, started: req.params.source, pid: child.pid });
});

// ─── Agent Registry (Paperclip-Copy in-house) ───────────────────────────────
// Tables: registry_agents, registry_agent_runs, registry_agent_memory, registry_agent_relations
// View:   registry_agents_kpi
// Naming distinct from /api/agents (which polls Paperclip).

app.get('/api/registry/agents', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data, error } = await sb
      .from('registry_agents_kpi')
      .select('*')
      .order('project', { ascending: true })
      .order('parent_id', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'registry_query_failed', detail: e.message });
  }
});

app.get('/api/registry/agents/:id', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const [agentRes, memRes, relRes, runsRes] = await Promise.all([
      sb.from('registry_agents').select('*').eq('id', req.params.id).single(),
      sb.from('registry_agent_memory').select('*').eq('agent_id', req.params.id).order('memory_type'),
      sb.from('registry_agent_relations').select('*').or(`from_agent_id.eq.${req.params.id},to_agent_id.eq.${req.params.id}`),
      sb.from('registry_agent_runs').select('id,trigger_source,started_at,finished_at,status,cost_eur,input_tokens,output_tokens,cache_read_tokens,error_message')
        .eq('agent_id', req.params.id).order('started_at', { ascending: false }).limit(20),
    ]);
    if (agentRes.error) {
      if (agentRes.error.code === 'PGRST116') return res.status(404).json({ error: 'agent_not_found' });
      throw agentRes.error;
    }
    res.json({
      agent: agentRes.data,
      memory: memRes.data || [],
      relations: relRes.data || [],
      runs_recent: runsRes.data || [],
    });
  } catch (e) {
    res.status(500).json({ error: 'agent_detail_failed', detail: e.message });
  }
});

app.get('/api/registry/agents/:id/runs', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  try {
    const { data, error } = await sb.from('registry_agent_runs')
      .select('*').eq('agent_id', req.params.id)
      .order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'runs_query_failed', detail: e.message });
  }
});

app.get('/api/registry/stats', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data: all, error: allErr } = await sb.from('registry_agents').select('status,role,project,total_cost_eur_30d,total_runs_30d');
    if (allErr) throw allErr;
    const summary = {
      total: all.length,
      by_status: {},
      by_role: {},
      by_project: {},
      cost_30d_total_eur: 0,
      runs_30d_total: 0,
    };
    for (const a of all) {
      summary.by_status[a.status] = (summary.by_status[a.status] || 0) + 1;
      summary.by_role[a.role] = (summary.by_role[a.role] || 0) + 1;
      summary.by_project[a.project || 'unset'] = (summary.by_project[a.project || 'unset'] || 0) + 1;
      summary.cost_30d_total_eur += Number(a.total_cost_eur_30d || 0);
      summary.runs_30d_total += Number(a.total_runs_30d || 0);
    }
    summary.cost_30d_total_eur = +summary.cost_30d_total_eur.toFixed(4);
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: 'stats_failed', detail: e.message });
  }
});

// Auth middleware moved to top of file (before all routes)

// ─────────────────────────────────────────────────────────────────────────
// HERMES DASHBOARD ROUTES (Block I, 2026-05-28)
// Reads the NEW agents + agent_runs tables (Foundation 27.05.).
// Parallel zu /api/registry/* (älter, registry_agents). Konsolidierung pending.
// ─────────────────────────────────────────────────────────────────────────

app.get('/api/hermes/agents', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data: agents, error: aErr } = await sb.from('agents')
      .select('id,slug,name,layer,agent_type,status,endpoint,budget_cents_monthly,current_spend_cents,last_heartbeat_at')
      .order('slug');
    if (aErr) throw aErr;

    const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
    const enriched = await Promise.all((agents || []).map(async (a) => {
      const { data: lastRun } = await sb.from('agent_runs')
        .select('started_at,status,cost_cents,tokens_in,tokens_out')
        .eq('agent_id', a.id).order('started_at', { ascending: false }).limit(1);
      const { data: todayRuns } = await sb.from('agent_runs')
        .select('cost_cents,status')
        .eq('agent_id', a.id).gte('started_at', todayStart.toISOString());
      const today_cost_cents = (todayRuns || []).reduce((s,r) => s + (r.cost_cents||0), 0);
      const today_runs = (todayRuns || []).length;
      const today_failed = (todayRuns || []).filter(r => r.status === 'failed').length;
      return { ...a, last_run: lastRun && lastRun[0] || null, today_cost_cents, today_runs, today_failed };
    }));
    res.json({ items: enriched, count: enriched.length });
  } catch (e) {
    res.status(500).json({ error: 'hermes_agents_failed', detail: e.message });
  }
});

app.get('/api/hermes/runs', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const { data, error } = await sb.from('agent_runs')
      .select('id,agent_id,started_at,completed_at,status,cost_cents,tokens_in,tokens_out,model_used,output_summary,output_payload,error_message')
      .order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'hermes_runs_failed', detail: e.message });
  }
});

app.get('/api/hermes/cost-daily', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const days = Math.min(Number(req.query.days) || 14, 60);
  try {
    const since = new Date(); since.setUTCDate(since.getUTCDate() - days); since.setUTCHours(0,0,0,0);
    const { data, error } = await sb.from('agent_runs')
      .select('started_at,cost_cents,tokens_in,tokens_out,status,agent_id')
      .gte('started_at', since.toISOString());
    if (error) throw error;
    const { data: agents } = await sb.from('agents').select('id,slug');
    const slug = Object.fromEntries((agents||[]).map(a => [a.id, a.slug]));
    // Bucket by day (UTC)
    const buckets = {};
    for (const r of (data || [])) {
      const day = (r.started_at || '').slice(0, 10);
      if (!day) continue;
      if (!buckets[day]) buckets[day] = { date: day, total_cents: 0, runs: 0, success: 0, failed: 0, by_agent: {} };
      buckets[day].total_cents += (r.cost_cents || 0);
      buckets[day].runs += 1;
      if (r.status === 'success') buckets[day].success += 1;
      if (r.status === 'failed') buckets[day].failed += 1;
      const s = slug[r.agent_id] || 'unknown';
      buckets[day].by_agent[s] = (buckets[day].by_agent[s] || 0) + (r.cost_cents || 0);
    }
    const result = Object.values(buckets).sort((a,b) => a.date.localeCompare(b.date));
    res.json({ days, items: result });
  } catch (e) {
    res.status(500).json({ error: 'cost_daily_failed', detail: e.message });
  }
});

app.get('/api/hermes/cost-summary', async (_req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setUTCHours(0,0,0,0);
    const weekStart = new Date(now); weekStart.setUTCDate(now.getUTCDate() - 7);
    const monthStart = new Date(now); monthStart.setUTCDate(1); monthStart.setUTCHours(0,0,0,0);

    const buckets = [
      ['today', todayStart], ['week_7d', weekStart], ['month', monthStart],
    ];
    const result = {};
    for (const [name, since] of buckets) {
      const { data } = await sb.from('agent_runs')
        .select('cost_cents,tokens_in,tokens_out,status')
        .gte('started_at', since.toISOString());
      const rows = data || [];
      result[name] = {
        runs: rows.length,
        success: rows.filter(r => r.status === 'success').length,
        failed: rows.filter(r => r.status === 'failed').length,
        cost_cents: rows.reduce((s,r) => s + (r.cost_cents||0), 0),
        tokens: rows.reduce((s,r) => s + (r.tokens_in||0) + (r.tokens_out||0), 0),
      };
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'cost_summary_failed', detail: e.message });
  }
});

app.get('/api/hermes/reports', (req, res) => {
  try {
    const dir = '/home/carlos/personal-os/08-research/observer-reports';
    if (!fs.existsSync(dir)) return res.json({ items: [] });
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    const items = files.map(f => {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      return { filename: f, size: st.size, mtime: st.mtime.toISOString() };
    }).sort((a,b) => b.mtime.localeCompare(a.mtime));
    res.json({ items: items.slice(0, Number(req.query.limit) || 30) });
  } catch (e) {
    res.status(500).json({ error: 'reports_failed', detail: e.message });
  }
});

app.get('/api/hermes/agents/:slug', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  try {
    const { data: a, error } = await sb.from('agents').select('*').eq('slug', slug).single();
    if (error || !a) return res.status(404).json({ error: 'agent_not_found' });

    const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
    const weekStart = new Date(); weekStart.setUTCDate(weekStart.getUTCDate()-7);

    const [{ data: todayRuns }, { data: weekRuns }, { data: lastRun }] = await Promise.all([
      sb.from('agent_runs').select('cost_cents,status').eq('agent_id', a.id).gte('started_at', todayStart.toISOString()),
      sb.from('agent_runs').select('cost_cents,tokens_in,tokens_out,status,started_at').eq('agent_id', a.id).gte('started_at', weekStart.toISOString()),
      sb.from('agent_runs').select('*').eq('agent_id', a.id).order('started_at', { ascending: false }).limit(1),
    ]);

    res.json({
      agent: a,
      stats: {
        today: {
          runs: (todayRuns||[]).length,
          cost_cents: (todayRuns||[]).reduce((s,r) => s + (r.cost_cents||0), 0),
          failed: (todayRuns||[]).filter(r => r.status === 'failed').length,
        },
        week_7d: {
          runs: (weekRuns||[]).length,
          cost_cents: (weekRuns||[]).reduce((s,r) => s + (r.cost_cents||0), 0),
          tokens: (weekRuns||[]).reduce((s,r) => s + (r.tokens_in||0) + (r.tokens_out||0), 0),
          failed: (weekRuns||[]).filter(r => r.status === 'failed').length,
        },
      },
      last_run: (lastRun || [])[0] || null,
    });
  } catch (e) {
    res.status(500).json({ error: 'agent_detail_failed', detail: e.message });
  }
});

app.get('/api/hermes/agents/:slug/runs', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    const { data: a } = await sb.from('agents').select('id').eq('slug', slug).single();
    if (!a) return res.status(404).json({ error: 'agent_not_found' });
    const { data, error } = await sb.from('agent_runs')
      .select('id,started_at,completed_at,status,cost_cents,tokens_in,tokens_out,model_used,output_summary,output_payload,error_message')
      .eq('agent_id', a.id).order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    res.status(500).json({ error: 'agent_runs_failed', detail: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Knowledge endpoints — file-browser + upload per Agent
// ─────────────────────────────────────────────────────────────────────────

function _knowledgeBase(slug) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return null;
  const agentDir = slug.replace(/^hermes-/, '');
  if (!/^[a-z0-9-]+$/i.test(agentDir)) return null;
  const base = path.join('/home/carlos/.hermes/agents', agentDir, 'KNOWLEDGE');
  if (!fs.existsSync(base)) return null;
  return base;
}

function _validCategory(cat) {
  return ['coaching', 'research', 'learnings'].includes(cat);
}

function _validFilename(fn) {
  return /^[a-z0-9_\-.]+\.md$/i.test(fn) && !fn.includes('..');
}

app.get('/api/hermes/agents/:slug/knowledge', (req, res) => {
  const base = _knowledgeBase(req.params.slug);
  if (!base) return res.status(400).json({ error: 'invalid_slug_or_not_found' });
  const result = { coaching: [], research: [], learnings: [] };
  for (const cat of Object.keys(result)) {
    const dir = path.join(base, cat);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    result[cat] = files.map(f => {
      const st = fs.statSync(path.join(dir, f));
      return { filename: f, size: st.size, mtime: st.mtime.toISOString() };
    }).sort((a,b) => b.mtime.localeCompare(a.mtime));
  }
  res.json(result);
});

app.get('/api/hermes/agents/:slug/knowledge/:category/:filename', (req, res) => {
  const base = _knowledgeBase(req.params.slug);
  if (!base) return res.status(400).json({ error: 'invalid_slug' });
  if (!_validCategory(req.params.category)) return res.status(400).json({ error: 'invalid_category' });
  if (!_validFilename(req.params.filename)) return res.status(400).json({ error: 'invalid_filename' });
  const p = path.join(base, req.params.category, req.params.filename);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
  res.json({ filename: req.params.filename, content: fs.readFileSync(p, 'utf8') });
});

app.post('/api/hermes/agents/:slug/knowledge/:category', express.json({ limit: '500kb' }), (req, res) => {
  const base = _knowledgeBase(req.params.slug);
  if (!base) return res.status(400).json({ error: 'invalid_slug' });
  if (!_validCategory(req.params.category)) return res.status(400).json({ error: 'invalid_category' });
  // Carlos shouldn't upload to learnings/ directly (that's auto from runs)
  if (req.params.category === 'learnings') return res.status(403).json({ error: 'learnings_auto_only' });
  const { filename, content } = req.body || {};
  if (!filename || !_validFilename(filename)) return res.status(400).json({ error: 'invalid_filename' });
  if (typeof content !== 'string' || content.length === 0) return res.status(400).json({ error: 'empty_content' });
  if (content.length > 200000) return res.status(413).json({ error: 'too_large', max: 200000 });
  const dir = path.join(base, req.params.category);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, filename);
  fs.writeFileSync(p, content);
  res.json({ saved: req.params.filename, path: p, size: content.length });
});

app.delete('/api/hermes/agents/:slug/knowledge/:category/:filename', (req, res) => {
  const base = _knowledgeBase(req.params.slug);
  if (!base) return res.status(400).json({ error: 'invalid_slug' });
  if (!_validCategory(req.params.category)) return res.status(400).json({ error: 'invalid_category' });
  if (!_validFilename(req.params.filename)) return res.status(400).json({ error: 'invalid_filename' });
  const p = path.join(base, req.params.category, req.params.filename);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
  fs.unlinkSync(p);
  res.json({ deleted: req.params.filename });
});

// ─────────────────────────────────────────────────────────────────────────
// Knowledge — Binary uploads via Supabase Storage (PDF/MP3/ZIP up to 50MB)
// Ready-to-use, not default active. Switch when text-only-VPS becomes limit.
// ─────────────────────────────────────────────────────────────────────────

const BUCKET = 'hermes-knowledge';
const BINARY_CATEGORIES = ['coaching', 'research', 'attachments'];

app.get('/api/hermes/binary/:slug/list', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  if (!/^[a-z0-9-]+$/i.test(slug)) return res.status(400).json({ error: 'invalid_slug' });
  const agentDir = slug.replace(/^hermes-/, '');
  try {
    const result = { coaching: [], research: [], attachments: [] };
    for (const cat of BINARY_CATEGORIES) {
      const { data } = await sb.storage.from(BUCKET).list(`${agentDir}/${cat}`, { limit: 100 });
      result[cat] = (data || []).filter(f => f.name).map(f => ({
        name: f.name,
        size: f.metadata?.size || 0,
        mtime: f.updated_at,
        mime: f.metadata?.mimetype || 'application/octet-stream',
      }));
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'binary_list_failed', detail: e.message });
  }
});

app.post('/api/hermes/binary/:slug/upload', express.json({ limit: '60mb' }), async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  if (!/^[a-z0-9-]+$/i.test(slug)) return res.status(400).json({ error: 'invalid_slug' });
  const agentDir = slug.replace(/^hermes-/, '');
  const { category, filename, content_base64, mime } = req.body || {};
  if (!BINARY_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid_category', allowed: BINARY_CATEGORIES });
  if (!filename || !/^[a-z0-9_\-.]+\.[a-z0-9]+$/i.test(filename)) return res.status(400).json({ error: 'invalid_filename' });
  if (!content_base64) return res.status(400).json({ error: 'missing_content_base64' });

  try {
    const buf = Buffer.from(content_base64, 'base64');
    if (buf.length > 50 * 1024 * 1024) return res.status(413).json({ error: 'too_large', max_mb: 50 });
    const filePath = `${agentDir}/${category}/${filename}`;
    const { error } = await sb.storage.from(BUCKET).upload(filePath, buf, {
      contentType: mime || 'application/octet-stream',
      upsert: true,
    });
    if (error) throw error;
    res.json({ saved: filename, path: filePath, size: buf.length });
  } catch (e) {
    res.status(500).json({ error: 'upload_failed', detail: e.message });
  }
});

app.get('/api/hermes/binary/:slug/:category/:filename', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  if (!/^[a-z0-9-]+$/i.test(slug)) return res.status(400).json({ error: 'invalid_slug' });
  const agentDir = slug.replace(/^hermes-/, '');
  if (!BINARY_CATEGORIES.includes(req.params.category)) return res.status(400).json({ error: 'invalid_category' });
  if (!/^[a-z0-9_\-.]+\.[a-z0-9]+$/i.test(req.params.filename)) return res.status(400).json({ error: 'invalid_filename' });
  const filePath = `${agentDir}/${req.params.category}/${req.params.filename}`;
  try {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(filePath, 300); // 5min TTL
    if (error) throw error;
    res.json({ url: data.signedUrl, ttl_seconds: 300 });
  } catch (e) {
    res.status(500).json({ error: 'signed_url_failed', detail: e.message });
  }
});

app.delete('/api/hermes/binary/:slug/:category/:filename', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  const slug = req.params.slug;
  if (!/^[a-z0-9-]+$/i.test(slug)) return res.status(400).json({ error: 'invalid_slug' });
  const agentDir = slug.replace(/^hermes-/, '');
  if (!BINARY_CATEGORIES.includes(req.params.category)) return res.status(400).json({ error: 'invalid_category' });
  if (!/^[a-z0-9_\-.]+\.[a-z0-9]+$/i.test(req.params.filename)) return res.status(400).json({ error: 'invalid_filename' });
  const filePath = `${agentDir}/${req.params.category}/${req.params.filename}`;
  try {
    const { error } = await sb.storage.from(BUCKET).remove([filePath]);
    if (error) throw error;
    res.json({ deleted: req.params.filename });
  } catch (e) {
    res.status(500).json({ error: 'delete_failed', detail: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Unified Registry View — combines agents + registry_agents (Marker #33)
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/hermes/unified-agents', async (req, res) => {
  const sb = sbOr503(res); if (!sb) return;
  try {
    const { data, error } = await sb.from('all_agents').select('*').order('source').order('slug');
    if (error) throw error;
    res.json({
      items: data || [],
      count: (data || []).length,
      by_source: (data || []).reduce((acc, a) => { acc[a.source] = (acc[a.source]||0)+1; return acc; }, {}),
    });
  } catch (e) {
    res.status(500).json({ error: 'unified_agents_failed', detail: e.message });
  }
});

app.get('/api/hermes/agents/:slug/prompt', (req, res) => {
  const slug = req.params.slug;
  // strip hermes- prefix for filesystem lookup
  const agentDir = slug.replace(/^hermes-/, '');
  if (!/^[a-z0-9-]+$/i.test(agentDir)) return res.status(400).json({ error: 'invalid_slug' });
  const p = path.join('/home/carlos/.hermes/agents', agentDir, 'PROMPT.md');
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'prompt_not_found', path: p });
  res.json({ slug, path: p, content: fs.readFileSync(p, 'utf8') });
});

app.get('/api/hermes/reports/:filename', (req, res) => {
  const fn = req.params.filename;
  if (!/^[a-z0-9-]+\.md$/i.test(fn)) return res.status(400).json({ error: 'invalid_filename' });
  const p = path.join('/home/carlos/personal-os/08-research/observer-reports', fn);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
  res.type('text/plain').send(fs.readFileSync(p, 'utf8'));
});

// /dashboard/hermes is now served by the SPA (Hermes section) — redirect old standalone path
app.get('/dashboard/hermes', (_req, res) => res.redirect(302, '/'));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log('Lennox OS :' + PORT));
