const express = require('express');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 4000;
const PM2 = '/home/carlos/.nvm/versions/node/v22.22.2/bin/pm2';
const PAPERCLIP = 'http://127.0.0.1:3100';
const COMPANY = '28d618a1-c170-47da-b552-69106000c20b';

const ALLOWED_SERVICES = [
  'cloudflared-tunnel','idea-factory-bot','lennox-os','lennox-terminal',
  'nexus-bot','openclaw-gateway','openrouter-bridge','paperclip','weekly-insight',
];

app.use(express.json());

// Terminal proxy (WebSocket + HTTP)
const terminalProxy = createProxyMiddleware({
  target: 'http://127.0.0.1:7681',
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/terminal': '' },
});
app.use('/terminal', terminalProxy);

app.get('/api/services', (_req, res) => {
  try {
    const raw = execSync(`${PM2} jlist 2>/dev/null`).toString().trim();
    const list = JSON.parse(raw);
    res.json(list.map(s => ({
      id: s.pm_id,
      name: s.name,
      status: s.pm2_env.status,
      cpu: s.monit?.cpu ?? 0,
      memory: Math.round((s.monit?.memory ?? 0) / 1024 / 1024),
      restarts: s.pm2_env.restart_time ?? 0,
      uptime: s.pm2_env.pm_uptime ?? 0,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/services/:name/restart', (req, res) => {
  const name = req.params.name;
  if (!ALLOWED_SERVICES.includes(name)) return res.status(400).json({ error: 'unknown service' });
  try {
    execFileSync(PM2, ['restart', name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/issues', async (_req, res) => {
  try {
    const ACTIVE = ['open','in_progress','in_review','blocked','todo','backlog'].join(',');
    const r = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues?limit=50&status=${ACTIVE}`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/issues', async (req, res) => {
  try {
    const r = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Monitor API
const os = require('os');

app.get('/api/monitor', (_req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const diskRaw = execSync("df -BM / | awk 'NR==2 {print $2, $3, $4, $5}'").toString().trim();
    const [diskTotal, diskUsed, diskFree, diskPct] = diskRaw.split(' ');
    res.json({
      memory: { total: totalMem, used: totalMem - freeMem },
      loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
      cpu: { cores: cpuCount, loadPct: Math.round((loadAvg[0] / cpuCount) * 100) },
      disk: { total: diskTotal, used: diskUsed, free: diskFree, pct: diskPct },
      uptime: os.uptime(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Logs API
app.get('/api/logs/:name', (req, res) => {
  const name = req.params.name;
  if (!ALLOWED_SERVICES.includes(name)) return res.status(400).json({ error: 'unknown service' });
  const lines = Math.min(parseInt(req.query.lines) || 150, 500);
  const logDir = '/home/carlos/.pm2/logs';
  try {
    const fs2 = require('fs');
    const outFile = path.join(logDir, `${name}-out.log`);
    const errFile = path.join(logDir, `${name}-error.log`);
    const out = fs2.existsSync(outFile) ? execSync(`tail -${lines} "${outFile}"`).toString() : '';
    const err = fs2.existsSync(errFile) ? execSync(`tail -${lines} "${errFile}"`).toString() : '';
    res.json({ name, out: out.trim(), err: err.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ideas API
const IDEAS_ROOT = '/home/carlos/personal-os/04-ideas';

function parseIdea(file, dir, defaultStatus) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (fmMatch) {
    fmMatch[1].split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx === -1) return;
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    });
  }
  const titleMatch = content.match(/^# (.+)/m);
  return {
    file,
    title: fm.titel || (titleMatch ? titleMatch[1] : file.replace('.md', '')),
    status: fm.status || defaultStatus,
    kategorie: fm.kategorie || defaultStatus,
    created: fm.created || '',
    bewertung: fm.bewertung || '',
    hebel: fm.hebel || '',
    prioritaet: fm.prioritaet || '',
  };
}

app.get('/api/ideas', (_req, res) => {
  const dirs = [
    { dir: path.join(IDEAS_ROOT, 'inbox'), status: 'inbox' },
    ...['business', 'content', 'personal', 'research', 'tools'].map(c => ({
      dir: path.join(IDEAS_ROOT, 'sorted', c), status: 'sorted',
    })),
    { dir: path.join(IDEAS_ROOT, 'archive'), status: 'archive' },
  ];
  const ideas = [];
  for (const { dir, status } of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
      try { ideas.push(parseIdea(file, dir, status)); } catch {}
    }
  }
  ideas.sort((a, b) => b.created.localeCompare(a.created));
  res.json(ideas);
});

app.post('/api/ideas', (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  const now = new Date();
  const slug = text.trim().toLowerCase().slice(0, 50).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const fname = `${date}-${time}-${slug}.md`;
  const content = `---\ncreated: ${now.toISOString()}\nsource: lennox-os\nstatus: inbox\n---\n\n# ${slug}\n\n## Original\n${text.trim()}\n`;
  const inbox = path.join(IDEAS_ROOT, 'inbox');
  if (!fs.existsSync(inbox)) fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, fname), content, 'utf8');
  res.json({ ok: true, file: fname });
});

// Files API
const fs = require('fs');
const SAFE_ROOT = '/';

function safePath(p) {
  const resolved = path.resolve(p || SAFE_ROOT);
  if (!resolved.startsWith(SAFE_ROOT)) return null;
  return resolved;
}

app.get('/api/files', (req, res) => {
  const target = safePath(req.query.path || SAFE_ROOT);
  if (!target) return res.status(403).json({ error: 'forbidden' });
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(target).map(name => {
        try {
          const s = fs.statSync(path.join(target, name));
          return { name, type: s.isDirectory() ? 'dir' : 'file', size: s.size, mtime: s.mtimeMs, birthtime: s.birthtimeMs };
        } catch { return null; }
      }).filter(Boolean);
      res.json({ path: target, type: 'dir', entries });
    } else {
      const content = fs.readFileSync(target, 'utf8');
      res.json({ path: target, type: 'file', content });
    }
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Lennox OS :${PORT}`));
