# NEXUS — Available Tools

## Paperclip API (via `paperclip` skill — built-in)

Core interface for all coordination work. Always available.

```
GET  /api/agents/me                                       → ID, Rolle, Budget
GET  /api/companies/{companyId}/issues?assigneeAgentId={id}&status=todo,in_progress,blocked
POST /api/companies/{companyId}/issues                    → neues Issue erstellen
POST /api/issues/{id}/checkout                            → Issue übernehmen
POST /api/issues/{id}/comments                            → Status-Kommentar
PATCH /api/issues/{id}                                    → status, assignee, priority
PATCH /api/agents/{id}                                    → agent config updaten
POST /api/issues/{id}/interactions                        → request_confirmation / suggest_tasks
GET  /api/companies/{companyId}/agents                    → alle Agents + Status
```

## fetch_url

Web-Fetching für Research, Lead-Prüfung, Markt-Analyse.

```
fetch_url(url: string, max_chars?: number)
→ { url, status, content, truncated }
```

## write_knowledge_file / read_knowledge_file

Persistenz für Output-Dokumente, Analysen, Templates.
Speicherort: `/home/carlos/personal-os/07-tools/docs-knowledge/`
Naming: `nexus_YYYY-MM-DD_<slug>.md`

## Budget-Info

- Dein Budget: 0/Mo
- Pro Issue: max .00
- Pro Run: max 15 Tool-Iterations
- Global Day-Cap: 0

## Agent-Register (aktuelle IDs — neue Instanz 2026-05-11)

| Agent      | ID                                   | Rolle         | Modell          |
|------------|--------------------------------------|---------------|-----------------|
| NEXUS      | 12fe6801-c9e1-4a2b-aa0a-01c38ac69496 | CEO (du)      | claude-sonnet-4-5 |
| PMO        | a60ce9d1-d8d9-4607-9ef2-eb3903f5ecc8 | Project Mgmt  | claude-haiku-4-5 |
| CODER      | 2d380d93-58d5-4536-9ea6-5200ec7185cd | Engineering   | claude-sonnet-4-5 |
| RESEARCHER | d0de4dce-2cb9-4ff1-9c4b-cc66b00081ed | Research      | claude-sonnet-4-5 |
| OPERATOR   | 5ada4e4b-7e80-49e5-9254-146df3440f75 | DevOps/Infra  | claude-haiku-4-5 |
| DOCS       | a6af1dcd-0e33-4c86-9526-e3d2aedc737e | Knowledge     | claude-haiku-4-5 |

Company ID: `7b5160b6-fd57-44b9-a3ba-f989e15a8597`
Paperclip URL: `http://localhost:3100` (intern) / `https://paperclip.lennoxos.com` (extern)

## VPS Filesystem Tools (via agent-core Telegram Bot)

Agent-Core gibt NEXUS und allen Agents direkten VPS-Zugriff:
- `read_file(path)` — Datei lesen
- `write_file(path, content)` — Datei schreiben/erstellen
- `execute_command(cmd)` — Shell-Befehl ausführen
- `pm2_action(action, name)` — pm2 list/restart/stop/start/logs
- `git_commit(repo_path, message, push)` — stage+commit+push
- `list_directory(path)` — Verzeichnis auflisten
- `create_issue(title, description, priority, agent)` — LEN-Issue via Bot
