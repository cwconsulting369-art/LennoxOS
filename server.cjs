const express = require('express');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Load .env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  }
} catch {}

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const AIRTABLE_IDEAS_BASE = process.env.AIRTABLE_IDEAS_BASE || 'appJDdfkdzsIhuSUc';
const AIRTABLE_IDEAS_TABLE = process.env.AIRTABLE_IDEAS_TABLE || 'tblpLr3Tb9AlojdVE';

const app = express();
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
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues?limit=50`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/agents`);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
      fetch(`${PAPERCLIP}/api/companies/${COMPANY}/projects`),
      fetch(`${PAPERCLIP}/api/companies/${COMPANY}/agents`),
      fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues?limit=200`),
      fetch(`${PAPERCLIP}/api/companies/${COMPANY}/labels`),
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
    const total = j.data.filter(c => c.status === 'succeeded').reduce((sum, c) => sum + c.amount, 0) / 100;
    // Build daily revenue series
    const series = {};
    j.data.filter(c => c.status === 'succeeded').forEach(c => {
      const d = new Date(c.created * 1000).toISOString().split('T')[0];
      series[d] = (series[d] || 0) + c.amount / 100;
    });
    const dailyRevenue = Object.entries(series)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));
    return { totalCents: Math.round(total * 100), total, dailyRevenue, count: j.data.length };
  } catch (e) { return { error: e.message }; }
}

async function paperclipAgentSummary() {
  try {
    const COMPANY = '7b5160b6-fd57-44b9-a3ba-f989e15a8597';
    const r = await fetch(`http://127.0.0.1:3100/api/companies/${COMPANY}/agents`);
    if (!r.ok) return null;
    const agents = await r.json();
    const arr = Array.isArray(agents) ? agents : (agents.items || []);
    return {
      total: arr.length,
      active: arr.filter(a => ['idle', 'running', 'in_progress'].includes(a.status)).length,
      error: arr.filter(a => a.status === 'error').length,
      list: arr.map(a => ({ id: a.id, name: a.nameKey || a.name, status: a.status })),
    };
  } catch (e) { return { error: e.message }; }
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

app.get('/api/master/overview', async (_req, res) => {
  if (Date.now() - masterCache.ts < 60_000 && masterCache.data) {
    return res.json({ ...masterCache.data, cached: true });
  }
  const [mrr, recent, agents, services, vercel, traffic, osHealth] = await Promise.all([
    stripeMRR(),
    stripeRecentRevenue(30),
    paperclipAgentSummary(),
    pm2ServicesSummary(),
    vercelDeployments(),
    cloudflareTraffic(),
    osHealthChecks(),
  ]);
  const data = {
    generatedAt: new Date().toISOString(),
    cashflow: { mrr, recent },
    agents,
    services,
    vercel,
    traffic,
    osHealth,
  };
  masterCache.ts = Date.now();
  masterCache.data = data;
  res.json(data);
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

// Auth middleware moved to top of file (before all routes)

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log('Lennox OS :' + PORT));
