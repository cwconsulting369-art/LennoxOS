# LennoxOS Dashboard — Roadmap & Audit

**Stand:** 2026-05-11  
**Letzter Audit:** vollständig (server.cjs + alle 19 Pages)  
**Dashboard:** lennoxos.com:4000 | Stack: Vite + React + Express | PM2: lennox-os

---

## ✅ LIVE & FUNKTIONIERT (echte Daten)

| Page | Datenbasis | Anmerkung |
|---|---|---|
| Command Center | PM2 + Paperclip | Services + Issues in Echtzeit |
| Issues / IssueBoard | Paperclip API | Kanban, Filter, Suche |
| Agent Control | Paperclip API | Agents mit Status, Budget |
| Monitor | /proc/ + PM2 | CPU, RAM, Disk, Uptime live |
| Log Central | PM2 logs | Real-time Log-Tail pro Service |
| Process Explorer | ps aux | Top-20 Prozesse nach CPU |
| Network Monitor | ss + /proc/net/dev | Ports + Interface-Stats |
| Ideas | personal-os/04-ideas/inbox/ | Lesen + Neu erstellen |
| Projects | personal-os/01-business/ | Verzeichnis-basiert |
| Personal OS | Dateisystem-Browser | Lesen + Schreiben |
| Backups | /home/carlos/backups/ | Datei-Liste mit Timestamps |
| Links | links.json | CRUD vollständig |
| Terminal | iframe terminal.lennoxos.com | ttyd-Zugang |
| Files | /home/carlos/ Filesystem | Lesen + Schreiben |
| Gold Bot Dashboard | lennox-gold-bot:8001 | MT5 Demo verbunden, echte PnL |

---

## ⚠️ TEILWEISE / MIT PROBLEMEN

| Page/Feature | Problem | Fix nötig |
|---|---|---|
| **Pipeline** | Folders leer (keine .md-Dateien in leads/prospects/customers); HOFFMANN-Karte hardcoded im Code | MD-Files anlegen für echte Prospects |
| **Alerts** | 3 Sektionen = "Kommt bald" (Threshold-Alerts, TG-Notify, Regeln) | Implementation pending |
| **Metrics** | 1 Sektion = "Kommt bald" (historische CPU/RAM-Charts) | Time-Series Storage nötig |
| **nexus-bot** | PM2-Status: stopped | Debug + Restart |
| **lennox-gold-bot** | 25 Restarts (instabil) | Logs prüfen, Crash-Grund finden |

---

## ❌ PLATZHALTER (kein echtes Backend)

| Page | Was fehlt |
|---|---|
| **Finance** | Komplett leer: MRR, ARR, Revenue Chart, Rechnungen, Kosten = alle "Kommt bald". Stripe-Integration fehlt |

---

## 🔧 FIXES HEUTE ANGEWENDET

1. **POST /api/issues** — fehlte in server.cjs → "Create Issue" Button schlug fehl (404). Jetzt gefixt.
2. **ALLOWED_SERVICES** — veraltete Service-Namen (personal-os-dashboard, lennox-notifier, openclaw-gateway). Aktualisiert auf echte PM2-Namen.
3. **lennox-os** — neu gestartet nach Patches.

### Audit-Fixes 2026-05-11 (LEN-4)

4. **COMPANY ID** — server.cjs hatte alte Company-ID `28d618a1...` → Issues + Agents leer. Auf `7b5160b6...` (LennoxOS v2) korrigiert.
5. **Agents API `?limit=100`** — Paperclip-Endpunkt unterstützt `limit` nicht → Error. Parameter entfernt.
6. **IssueBoard identifier** — zeigte UUID statt `LEN-N` Identifier. `issue.identifier ?? issue.id.slice(0,8)` gefixt.
7. **IssueBoard priority 'critical'** — fehlte in PRIORITY_BORDER/PRIORITY_LABEL maps → alle kritischen Issues grau. Jetzt rot.
8. **Hoffmann Eitle hardcoded** — Pipeline.tsx hatte HOFFMANN-Konstante. MD-File in `03-pipeline/prospects/hoffmann-eitle.md` angelegt, Hardcode entfernt.

---

## 📋 ROADMAP — WAS NOCH GEBAUT WERDEN MUSS

### 🔴 Priorität 1 — Kritisch / Datenlücken

#### [R-01] Finance-Page: Stripe-Integration
**Was:** MRR, ARR, Einnahmen-Chart, Rechnungsliste, Kosten-Breakdown  
**Wie:** server.cjs: neuer `/api/finance/*` Block mit Stripe SDK. Pages: Finance.tsx ersetzen.  
**Env nötig:** `STRIPE_SECRET_KEY` in `/home/carlos/.env-master` vorhanden  
**Aufwand:** ~4h

#### [R-02] Pipeline: Echte MD-Dateien anlegen
**Was:** personal-os/03-pipeline/prospects/, leads/, customers/ befüllen  
**Wie:** Für jeden aktiven Prospect ein Frontmatter-MD (name, status, priority, deal-value, next-action)  
**Aufwand:** ~30min

#### [R-03] nexus-bot debuggen + starten
**Was:** NEXUS Telegram-Bot stopped, warum?  
**Wie:** `pm2 logs nexus-bot` lesen, Fehler beheben, `pm2 start nexus-bot`  
**Aufwand:** ~30min-2h

#### [R-04] GoldBot Stabilität
**Was:** 25 Restarts = Crash-Loop-Indikator  
**Wie:** `pm2 logs lennox-gold-bot --lines 200` analysieren, Crash-Grund finden  
**Aufwand:** ~1h

---

### 🟡 Priorität 2 — Dashboard-Qualität

#### [R-05] Today's Tasks Widget in Command Center
**Was:** `/api/today` endpoint existiert schon, liest `personal-os/02-tasks/today.md`. CommandCenter zeigt es aber nicht.  
**Wie:** CommandCenter.tsx: fetch('/api/today') + Markdown-Rendering als 4. Panel  
**Aufwand:** ~1h

#### [R-06] Issues PATCH/Status-Update vom Dashboard
**Was:** Issues-Board zeigt Karten aber Status-Änderungen (Drag & Drop oder Dropdown) fehlen  
**Wie:** server.cjs: `PATCH /api/issues/:id` → Paperclip PATCH. IssueBoard.tsx: Drag-Handler  
**Aufwand:** ~3h

#### [R-07] Alerts: Echte Threshold-Alerts
**Was:** Alerts-Page hat 3 Kommt-bald-Sektionen: Threshold-Alerts, TG-Notifications, Alert-Regeln  
**Wie:** server.cjs: Monitor-Polling intern, Alert-Conditions prüfen → Telegram via nexus-notifier  
**Aufwand:** ~4h

#### [R-08] Metrics: Zeit-Historien (CPU/RAM/Disk über Zeit)
**Was:** Aktuelle Metriken live, aber kein Verlauf  
**Wie:** Cron-Job auf VPS schreibt `/proc/stat` alle 60s in SQLite/JSON-Datei. Metrics.tsx: Chart via recharts  
**Aufwand:** ~3h

#### [R-09] Today.md Editor in Personal OS
**Was:** Personal OS zeigt Dateien, aber direktes Bearbeiten von today.md wäre nützlich  
**Wie:** PersonalOS.tsx: Edit-Modus für .md-Files mit Textarea + Save-Button (PUT /api/files/write existiert bereits)  
**Aufwand:** ~1h

---

### 🟢 Priorität 3 — Nice-to-Have

#### [R-10] Dashboard Auth / Passwortschutz
**Was:** Aktuell öffentlich zugänglich (kein Login)  
**Wie:** express: Basic Auth Middleware (wie terminal.lennoxos.com) oder Session-basiert  
**Aufwand:** ~1h

#### [R-11] Git Auto-Deploy
**Was:** Code-Änderungen lokal → manuelles scp/ssh → pm2 restart  
**Wie:** GitHub Webhook → VPS-Script → git pull + pm2 restart lennox-os  
**Aufwand:** ~2h

#### [R-12] Revenue Widget im Command Center
**Was:** Command Center zeigt Services + Issues, aber kein MRR/Revenue-KPI  
**Wie:** Nach Finance-Integration (R-01): kleines Revenue-Panel im Command Center  
**Aufwand:** ~1h (Abhängigkeit: R-01)

#### [R-13] Agents.tsx (verwaiste Seite) bereinigen
**Was:** src/pages/Agents.tsx existiert, ist aber nicht in App.tsx gerouted (AgentControl.tsx übernimmt die Funktion)  
**Wie:** Agents.tsx löschen oder in AgentControl.tsx integrieren  
**Aufwand:** ~15min

#### [R-14] Mobile Responsive Layout
**Was:** Sidebar + Grid-Layout funktioniert nicht auf Mobilgeräten  
**Wie:** Hamburger-Menu, collapsed Sidebar, responsive Grid  
**Aufwand:** ~4h

#### [R-15] Issue-Detail-View
**Was:** Klick auf Issue öffnet keinen Detail-View (kein Modal, keine Seite)  
**Wie:** Modal mit Issue-Details, Comments, Status-Änderung  
**Aufwand:** ~3h

#### [R-16] Personal-OS Sync-Status
**Was:** Kein Indikator wann letzter Sync von lokal → VPS war  
**Wie:** `/api/sync-status` → liest sync-vps.log. Dashboard: kleines Badge im PersonalOS-Header  
**Aufwand:** ~30min

---

## 📊 SERVICE STATUS (Stand Audit)

| Service | Status | Restarts | RAM |
|---|---|---|---|
| lennox-os | ✅ online | 11 | 80MB |
| paperclip | ✅ online | 3 | 657MB |
| openrouter-bridge | ✅ online | 0 | 36MB |
| cloudflared-tunnel | ✅ online | 3 | 41MB |
| idea-factory-bot | ✅ online | 0 | 47MB |
| lennox-terminal | ✅ online | 0 | 20MB |
| lennox-gold-bot | ⚠️ online | 25 | 59MB |
| chart-api | ✅ online | 0 | 30MB |
| agent-core | ✅ online | 0 | 41MB |
| weekly-insight | ✅ online | 0 | 32MB |
| nexus-bot | ❌ stopped | — | — |

---

## 🗂️ VPS INVENTAR (/home/carlos/)

| Ordner | Was | Zustand |
|---|---|---|
| lennox-os/ | Dashboard Code | aktiv, Port 4000 |
| paperclip/ | Agent-Tracker Backend | aktiv, Port 3100 |
| personal-os/ | MD-basiertes SSOT | aktiv, synced |
| personalos/ | Altes Next.js Dashboard | inaktiv (nicht deployed) |
| aevum/ | AEVUM Assets | aktiv |
| lennox-gold-bot/ | Trading Bot | aktiv, Port 8001 |
| openrouter-bridge/ | OpenRouter Proxy | aktiv, Port 3000 |
| agents/ | Agent-Configs | aktiv |
| backups/ | Backup-Dumps | aktiv, Cron 02:00 |
| archive/ | Archiviertes | inaktiv |
| chart-generator/ | Chart API | aktiv |

---

*Roadmap-Owner: Lennox (Co-Founder) | Zuletzt aktualisiert: 2026-05-11*
