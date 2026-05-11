const express = require('express');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 4000;
const PM2 = '/home/carlos/.nvm/versions/node/v22.22.2/bin/pm2';
const PAPERCLIP = 'http://127.0.0.1:3100';
const COMPANY = '28d618a1-c170-47da-b552-69106000c20b';

const ALLOWED_SERVICES = [
  'cloudflared-tunnel','idea-factory-bot','lennox-os','lennox-terminal',
  'nexus-bot','openclaw-gateway','openrouter-bridge','paperclip','weekly-insight',
  'personal-os-dashboard','lennox-notifier',
];

app.use(express.json());

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

// System Monitor

app.get('/api/monitor', (_req, res) => {
  try {
    const cpuRaw = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number);
    const total = cpuRaw.reduce((a, b) => a + b, 0);
    const idle = cpuRaw[3];
    const cpuUsage = Math.round(((total - idle) / total) * 100);

    const memRaw = fs.readFileSync('/proc/meminfo', 'utf8');
    const memTotal = parseInt(memRaw.match(/MemTotal:\s+(\d+)/)[1]);
    const memAvail = parseInt(memRaw.match(/MemAvailable:\s+(\d+)/)[1]);
    const memUsed = memTotal - memAvail;

    const diskRaw = execSync("df -k / 2>/dev/null | tail -1", { timeout: 3000 }).toString().trim().split(/\s+/);
    const diskTotal = parseInt(diskRaw[1]);
    const diskUsed = parseInt(diskRaw[2]);

    const uptimeRaw = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);

    res.json({
      cpu: { usage: cpuUsage },
      memory: {
        total: memTotal * 1024,
        used: memUsed * 1024,
        available: memAvail * 1024,
        usagePercent: Math.round((memUsed / memTotal) * 100),
      },
      disk: {
        total: diskTotal * 1024,
        used: diskUsed * 1024,
        usagePercent: Math.round((diskUsed / diskTotal) * 100),
      },
      uptime: uptimeRaw,
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
    const raw = execFileSync(PM2, ['logs', name, '--lines', String(lines), '--nostream'], { timeout: 8000 }).toString();
    res.json({ logs: raw });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ideas

const IDEAS_ROOT = '/home/carlos/personal-os/04-ideas/inbox';

function parseIdea(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
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
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/^# .+\n?/, '').trim();
  return {
    file: path.basename(filePath),
    title: fm.title || (titleMatch ? titleMatch[1] : path.basename(filePath, '.md')),
    date: fm.date || '',
    tags: fm.tags ? fm.tags.split(',').map(t => t.trim()) : [],
    status: fm.status || 'inbox',
    body,
  };
}

app.get('/api/ideas', (_req, res) => {
  try {
    if (!fs.existsSync(IDEAS_ROOT)) return res.json([]);
    const files = fs.readdirSync(IDEAS_ROOT).filter(f => f.endsWith('.md'));
    const ideas = files.map(f => {
      try { return parseIdea(path.join(IDEAS_ROOT, f)); } catch { return null; }
    }).filter(Boolean);
    res.json(ideas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ideas', (req, res) => {
  try {
    const { title, body = '', tags = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!fs.existsSync(IDEAS_ROOT)) fs.mkdirSync(IDEAS_ROOT, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const filename = `${date}-${slug}.md`;
    const content = `---\ntitle: ${title}\ndate: ${date}\ntags: ${tags.join(', ')}\nstatus: inbox\n---\n\n# ${title}\n\n${body}\n`;
    fs.writeFileSync(path.join(IDEAS_ROOT, filename), content, 'utf8');
    res.json({ ok: true, file: filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Files

const ALLOWED_ROOTS = [
  '/home/carlos/personal-os',
  '/home/carlos/lennox-os',
];

function isAllowedPath(p) {
  const resolved = path.resolve(p);
  return ALLOWED_ROOTS.some(root => resolved.startsWith(root));
}

app.get('/api/files', (req, res) => {
  const dir = req.query.path || '/home/carlos/personal-os';
  if (!isAllowedPath(dir)) return res.status(403).json({ error: 'Path not allowed' });
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const items = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.join(dir, e.name),
    }));
    res.json({ path: dir, items });
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
    const raw = execSync('ps aux --sort=-%cpu 2>/dev/null | head -20', { timeout: 5000 }).toString();
    const lines = raw.trim().split('\n');
    const header = lines[0];
    const procs = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0],
        pid: parts[1],
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parts[4],
        rss: parts[5],
        stat: parts[7],
        command: parts.slice(10).join(' ').slice(0, 80),
      };
    });
    res.json({ header, processes: procs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Agents

app.get('/api/agents', async (_req, res) => {
  try {
    const response = await fetch(`${PAPERCLIP}/api/companies/${COMPANY}/agents?limit=100`);
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

// Projects

app.get('/api/projects', (_req, res) => {
  const BASE = '/home/carlos/personal-os/01-business';
  try {
    const dirs = fs.readdirSync(BASE).filter(d => {
      try { return fs.statSync(path.join(BASE, d)).isDirectory(); } catch { return false; }
    });
    const projects = dirs.map(d => {
      const indexFile = path.join(BASE, d, 'INDEX.md');
      const roadmapFile = path.join(BASE, d, '00-ROADMAP.md');
      let description = '';
      let status = 'active';
      for (const f of [indexFile, roadmapFile]) {
        if (fs.existsSync(f)) {
          const content = fs.readFileSync(f, 'utf8');
          const lines = content.split('\n').filter(l => l.trim());
          description = lines.slice(0, 3).join(' ').replace(/^#+\s*/, '').slice(0, 200);
          break;
        }
      }
      return { id: d, name: d.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), description, status, path: d };
    });
    res.json(projects);
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

// GoldBot proxy
const GOLDBOT_URL = "http://127.0.0.1:8001";
app.get("/api/goldbot/:endpoint(*)", async (req, res) => {
  try {
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const r = await fetch(GOLDBOT_URL + "/" + req.params.endpoint + qs);
    res.json(await r.json());
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log('Lennox OS :' + PORT));
