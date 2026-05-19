# LennoxOS — Master-Repo

Lennox' eigenes Operating System: Dashboard + Agent-Core + Paperclip-Personas + Env-Management.

Folgt der globalen Regel **"1 Projekt = 1 Repo"**.

## Was gehört zu LennoxOS?

- **Dashboard** (Vite/Vue/React Frontend bei `lennoxos.com:4000`)
- **agent-core** (Telegram-Bot mit OpenRouter-Tools, der Lennox-Bot)
- **Paperclip-Agent-Instructions** (Personas für NEXUS + alle Sub-Agents)
- **Env-Management** (zentrale Doku aller API-Keys; Master in `~/.claude/.env`)

## Layout

```
LennoxOS/
├── apps/
│   └── dashboard/              [später] Dashboard-Code verschoben
├── services/
│   └── agent-core/             Telegram-Bot Lennox + OpenRouter tools (subtree absorbed)
├── agents/
│   └── instructions/           Paperclip-Personas (subtree absorbed)
│       ├── 12fe6801.../        NEXUS
│       ├── 2d380d93.../        CODER
│       ├── 5ada4e4b.../        OPERATOR
│       ├── a60ce9d1.../        PMO
│       ├── a6af1dcd.../        DOCS
│       └── d0de4dce.../        RESEARCHER
├── infra/
│   ├── env/                    .env.example Templates + Env-Doku
│   └── pm2/                    [später] zentrale pm2-Configs
├── data/                       [später] Dashboard-Datenexporte etc
├── docs/
│   └── legacy/                 alte DOCS.md, ROADMAP.md preserved
│
└── Wurzel-Files (Phase-1 Live-Site Dashboard)
    ├── src/, public/           Dashboard-Source (Vite)
    ├── server.cjs              Express-Server für lennoxos.com:4000
    ├── package.json, vite.config.ts, tsconfig.json
    ├── tailwind.config.js, postcss.config.js
    ├── index.html
    └── create_db_users.js, links.json
```

## Migration-Status

```
Phase 1 ✅  Monorepo-Skeleton, agent-core + paperclip-instructions absorbiert (mit history)
Phase 2 ⏳  VPS-Services optional auf neue Repo-Pfade umstellen
            - /home/carlos/services/agent-core/ → kann eventually aus LennoxOS/services/agent-core/ pullen
            - /home/carlos/.paperclip/.../agents/<id>/instructions/AGENTS.md → kann aus LennoxOS/agents/instructions/<id>/ pullen
Phase 3 ⏳  Dashboard nach apps/dashboard/ verschieben (wenn Vercel/cloudflared umkonfiguriert)
Phase 4 ⏳  Repos archivieren: agent-core, paperclip-instructions
```

## Komponenten-Status

| Komponente | VPS-Pfad (live) | GitHub-Pfad (neu) |
|---|---|---|
| Dashboard | `/home/carlos/lennox-os/` | LennoxOS/(root) → später `apps/dashboard/` |
| agent-core | `/home/carlos/services/agent-core/` | `LennoxOS/services/agent-core/` |
| Paperclip-Personas | `/home/carlos/.paperclip/.../agents/<id>/instructions/` | `LennoxOS/agents/instructions/<id>/` |

## Env-Management

Siehe `infra/env/README.md`.

- **Master:** `~/.claude/.env` (chmod 600, NIE committen)
- **Sync:** `~/scripts/sync-env-from-master.py`
- **Templates:** `.env.example` pro Komponente (in git)

## Cross-References

- Paperclip-Instances: `~/.paperclip/instances/default/storage/companies/7b5160b6.../agents/`
- pm2 Process Names: `lennox-os`, `agent-core`
- Domain: `lennoxos.com` (cloudflared → port 4000)

## Regel

**1 Projekt = 1 Repo.** Alle LennoxOS-Komponenten gehören hierher. **personal-os** und **goldtradersociety** und **AEVUM** sind eigene Projekte → eigene Repos.
