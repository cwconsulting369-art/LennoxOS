# LennoxOS Dashboard — Interne Dokumentation

**Zweck:** Diese Datei dokumentiert alle Dashboard-Features für Carlos und Agents.  
**Update:** bei jedem Feature-Ausbau aktualisieren.

---

## Architektur

```
lennoxos.com → Cloudflare Tunnel → VPS:4000
VPS:4000 → lennox-os (PM2) → server.cjs (Express) + dist/ (Vite SPA)
```

- **Frontend:** Vite + React + TypeScript → `/home/carlos/lennox-os/dist/`
- **Backend:** Express → `/home/carlos/lennox-os/server.cjs`
- **Build:** `npm run build` in `/home/carlos/lennox-os/`
- **Restart:** `pm2 restart lennox-os` (als user carlos)

---

## Pages & Features

### Workspace

#### Command Center (`/` → id: `command`)
- **Was:** Hauptübersicht. Services, Issues, Quick Actions, Today's Tasks.
- **APIs:** `GET /api/services` (PM2), `GET /api/issues` (Paperclip), `GET /api/today` (personal-os/02-tasks/today.md)
- **Post:** `POST /api/issues` (Paperclip) für neue Issues
- **Status:** ✅ voll funktional

#### Issues (`id: issues`)
- **Was:** Kanban-Board aller Paperclip-Issues. Filter nach Status, Suche.
- **APIs:** `GET /api/issues` → Paperclip `http://127.0.0.1:3100`
- **Limit:** 50 Issues (in server.cjs anpassbar)
- **Status:** ✅ voll funktional

#### Pipeline (`id: pipeline`)
- **Was:** AEVUM Sales Pipeline aus MD-Dateien.
- **APIs:** `GET /api/pipeline` → liest `/home/carlos/personal-os/03-pipeline/{leads,prospects,customers}/`
- **Format:** Frontmatter-MD (Template: `/home/carlos/personal-os/03-pipeline/TEMPLATE.md`)
- **Hinweis:** HOFFMANN-Karte ist hardcoded in Pipeline.tsx als Fallback
- **Status:** ⚠️ API real, aber Pipeline-Ordner noch leer — MD-Files manuell anlegen

#### Agent Control (`id: agents`)
- **Was:** Alle Agents in 2 Sektionen: Paperclip-Agents + VPS-Services.
- **APIs:** `GET /api/agents` (Paperclip), `GET /api/vps-agents` (PM2 jlist)
- **Paperclip-Agents:** KI-Agents mit Modell, Budget, Issue-Count (NEXUS, CODER, etc.)
- **VPS-Services:** PM2-Prozesse (lennox-os, paperclip, lennox-gold-bot, etc.) mit CPU/RAM/Restarts
- **Status:** ✅ voll funktional

#### Ideas (`id: ideas`)
- **Was:** Idea Inbox aus personal-os. Lesen, Erstellen, Filtern.
- **APIs:** `GET /api/ideas`, `POST /api/ideas` → `/home/carlos/personal-os/04-ideas/inbox/`
- **Status:** ✅ voll funktional

---

### System

#### Monitor (`id: monitor`)
- **Was:** System-Overview: CPU-Load, RAM, Disk, Uptime + Services-Tabelle + Prozesse + Logs.
- **APIs:** `GET /api/monitor`, `GET /api/services`, `GET /api/system/processes`, `GET /api/logs/:name`
- **Format:** `{ cpu: {cores, loadPct}, loadAvg: {'1m','5m','15m'}, memory: {total,used}, disk: {total,used,free,pct}, uptime }`
- **Status:** ✅ voll funktional (nach Fix 2026-05-11)

#### Logs (`id: logs`)
- **Was:** Log-Viewer für PM2-Services. Stdout/Stderr-Tabs, Auto-Refresh, Suche.
- **APIs:** `GET /api/logs/:name?lines=N` → liest `/home/carlos/.pm2/logs/{name}-{out|error}.log`
- **Services:** lennox-os, paperclip, lennox-gold-bot, openrouter-bridge, idea-factory-bot, agent-core, chart-api, cloudflared-tunnel, lennox-terminal, weekly-insight
- **Format:** `{ name, out: string, err: string }`
- **Status:** ✅ voll funktional (nach Fix 2026-05-11)

#### Prozesse (`id: processes`)
- **Was:** Alle laufenden System-Prozesse sortierbar nach CPU/RAM.
- **APIs:** `GET /api/system/processes` → `ps aux`
- **Format:** `{ processes: [{pid, user, cpu, memory, command, started}], total }`
- **Status:** ✅ voll funktional (nach Fix 2026-05-11)

#### Netzwerk (`id: network`)
- **Was:** Offene Ports + Netzwerk-Interfaces mit Traffic-Stats.
- **APIs:** `GET /api/network` → `ss -tuln` + `/proc/net/dev`
- **Status:** ✅ voll funktional

#### Metriken (`id: metrics`)
- **Was:** KPI-Kacheln (CPU, RAM, Disk, Uptime) + 1x ComingSoon (Zeit-Historien-Charts).
- **APIs:** `GET /api/monitor`
- **Roadmap:** R-08 — Zeit-Historien via SQLite-Cron
- **Status:** ⚠️ KPIs real, Charts-Sektion Platzhalter

#### Alerts (`id: alerts`)
- **Was:** Service-Status-Tabelle (real) + 3x ComingSoon (Threshold-Alerts, TG-Notify, Regeln).
- **APIs:** `GET /api/services`
- **Roadmap:** R-07 — echte Alert-Engine
- **Status:** ⚠️ Service-Status real, Alert-Logik Platzhalter

---

### OS

#### Projekte (`id: projects`)
- **Was:** Alle Projekte aus personal-os/01-business/ als Karten mit Beschreibung.
- **APIs:** `GET /api/projects` → `/home/carlos/personal-os/01-business/` Subdirs
- **Status:** ✅ voll funktional

#### Personal OS (`id: personal-os`)
- **Was:** Datei-Browser für personal-os SSOT. Lesen + Schreiben von MD-Files.
- **APIs:** `GET /api/files?path=...`, `PUT /api/files/write` 
- **Erlaubte Roots:** `/home/carlos/` (alles darunter)
- **Status:** ✅ voll funktional (nach Fix 2026-05-11)

#### Finance (`id: finance`)
- **Was:** MRR, ARR, Rechnungen, Kosten — ALLES Platzhalter.
- **Roadmap:** R-01 — Stripe-Integration (~4h)
- **Status:** ❌ kein echtes Backend

#### Backups (`id: backups`)
- **Was:** Liste aller Backup-Dateien mit Größe und Datum.
- **APIs:** `GET /api/backups` → `/home/carlos/backups/`
- **Status:** ✅ voll funktional

#### Links (`id: links`)
- **Was:** Bookmark-Manager. Hinzufügen, Löschen, Kategorisieren.
- **APIs:** `GET /api/links`, `POST /api/links`, `DELETE /api/links/:id` → `/home/carlos/lennox-os/links.json`
- **Status:** ✅ voll funktional

---

### Tools

#### Terminal (`id: terminal`)
- **Was:** iframe auf `terminal.lennoxos.com` (ttyd, Basic Auth).
- **Login:** carlos / LennoxOS2026!
- **Status:** ✅ funktional (iframe)

#### Files (`id: files`)
- **Was:** Erweiterter Datei-Browser mit Favoriten, History, Vorschau.
- **APIs:** `GET /api/files?path=...` (dir), `GET /api/files?path=...` (file → content)
- **Start-Pfad:** `/home/carlos/personal-os`
- **Status:** ✅ voll funktional (nach Fix 2026-05-11)

#### Gold Bot (`id: goldbot`)
- **Was:** MT5 Gold Trading Bot Dashboard. PnL, Live-Status, History, Patterns.
- **APIs:** `GET /api/goldbot/*` → proxy zu `http://127.0.0.1:8001` (lennox-gold-bot PM2)
- **Endpunkte:** `/metrics`, `/live`, `/status`, `/history`, `/patterns`, `/daily`
- **MT5:** Demo-Account 700105917 @ PUPrime-Demo, XAUUSD
- **Status:** ✅ voll funktional (MT5 connected)

---

## Server API Referenz

| Endpoint | Methode | Beschreibung |
|---|---|---|
| `/api/services` | GET | PM2 jlist — alle Services |
| `/api/services/:name/restart` | POST | PM2 restart (whitelist) |
| `/api/services/:name/stop` | POST | PM2 stop (whitelist) |
| `/api/issues` | GET | Paperclip Issues (limit 50) |
| `/api/issues` | POST | Paperclip Issue erstellen |
| `/api/issues/:id` | GET | Einzelnes Issue |
| `/api/monitor` | GET | OS-Metriken (CPU, RAM, Disk, Uptime) |
| `/api/logs/:name` | GET | PM2 Log-Dateien (out+err separat) |
| `/api/ideas` | GET | Ideas aus personal-os inbox |
| `/api/ideas` | POST | Neue Idea erstellen |
| `/api/files` | GET | Datei-Browser (dir oder file-content) |
| `/api/files/write` | PUT | Datei schreiben |
| `/api/system/processes` | GET | ps aux — Prozess-Liste |
| `/api/agents` | GET | Paperclip Agents |
| `/api/vps-agents` | GET | PM2 Services als Agents |
| `/api/pipeline` | GET | personal-os/03-pipeline/ MD-Files |
| `/api/network` | GET | Ports + Netzwerk-Interfaces |
| `/api/projects` | GET | personal-os/01-business/ Subdirs |
| `/api/today` | GET | personal-os/02-tasks/today.md |
| `/api/links` | GET/POST | Bookmark-Manager |
| `/api/links/:id` | DELETE | Bookmark löschen |
| `/api/backups` | GET | /home/carlos/backups/ Liste |
| `/api/goldbot/:endpoint` | GET | Proxy zu lennox-gold-bot:8001 |

---

## ALLOWED_SERVICES (restart/stop via Dashboard)

`cloudflared-tunnel`, `idea-factory-bot`, `lennox-os`, `lennox-terminal`, `openrouter-bridge`, `paperclip`, `weekly-insight`, `lennox-gold-bot`, `chart-api`, `agent-core`

---

## Roadmap (offen)

Vollständige Liste: `/home/carlos/lennox-os/ROADMAP.md`

Top 5:
1. **R-01** Finance: Stripe-Integration
2. **R-02** Pipeline: MD-Files für Prospects anlegen
3. **R-03** nexus-bot: debuggen + restart
4. **R-04** GoldBot: 25 Restarts analysieren
5. **R-05** Today's Tasks: ✅ DONE (2026-05-11)

---

*Zuletzt aktualisiert: 2026-05-11 — Lennox*
