# Available Tools

## Paperclip API (built-in via `paperclip` skill)

```
GET  /api/agents/me
GET  /api/companies/{id}/issues?assigneeAgentId={id}&status=todo,in_progress
POST /api/companies/{id}/issues          → neues Issue anlegen
POST /api/issues/{id}/checkout           → Issue übernehmen
POST /api/issues/{id}/comments           → Status-Update
PATCH /api/issues/{id}                   → status/assignee ändern
POST /api/issues/{id}/interactions       → request_confirmation
```

## fetch_url

```
fetch_url(url: string, max_chars?: number)
→ { url, status, content, truncated }
```

Für Research, Lead-Prüfung, Website-Analyse, Markt-Daten.

## write_knowledge_file

```
write_knowledge_file(filename: string, content: string)
→ { ok, filename, bytes }
```

Speicherort: /home/carlos/personal-os/07-tools/docs-knowledge/
Output-Naming: <AGENTNAME>_YYYY-MM-DD_<slug>.md

## read_knowledge_file

```
read_knowledge_file(filename?: string)
→ ohne filename: Liste aller Dateien
→ mit filename: Inhalt
```

## Limits

- Budget: per Agent-Config (€10-40/Mo)
- Pro Issue: max $3.00
- Pro Run: max 15 Iterations

## Agent-Register (aktuelle IDs — neue Instanz 2026-05-11)

| Agent | ID | Rolle |
|---|---|---|
| NEXUS | 12fe6801-c9e1-4a2b-aa0a-01c38ac69496 | CEO |
| PMO | a60ce9d1-d8d9-4607-9ef2-eb3903f5ecc8 | Project Mgmt |
| CODER | 2d380d93-58d5-4536-9ea6-5200ec7185cd | Engineering |
| RESEARCHER | d0de4dce-2cb9-4ff1-9c4b-cc66b00081ed | Research |
| OPERATOR | 5ada4e4b-7e80-49e5-9254-146df3440f75 | DevOps/Infra |
| DOCS | a6af1dcd-0e33-4c86-9526-e3d2aedc737e | Knowledge |

Company ID: 
