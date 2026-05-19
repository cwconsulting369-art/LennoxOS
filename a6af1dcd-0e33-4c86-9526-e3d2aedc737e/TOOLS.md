# TOOLS.md — DOCS Available Tools

## Primary Tools (every heartbeat)

| Tool | Purpose | When |
|------|---------|------|
| `lennox-knowledge-ingestor` skill | Structured ingest workflow | Every ingest task > 1 page |
| `WebFetch` | Fetch URLs and documents | When source is a URL |
| `WebSearch` | Source verification | When verifying claims |
| `Read` / `Write` | Memory file operations | Writing ingest outputs |
| Paperclip API via `paperclip` skill | Issue updates, comments | Every heartbeat |

## Secondary Tools

| Tool | Purpose | When |
|------|---------|------|
| `distill` skill | Reduce long content to core | Sources > 5 pages |
| `consolidate-memory` skill | Sync memory to personal-os | After batch ingests |
| Notion MCP | Ingest Notion pages | When source is Notion URL |

## Memory Paths

- Agent-specific knowledge: `~/.paperclip/instances/default/companies/{companyId}/agents/{agentId}/memory/`
- Cross-agent knowledge: write to NEXUS memory or company templates directory
- Format: para-memory-files standard (frontmatter + content)

## Frontmatter Template

```markdown
---
name: {title}
description: {one-line summary for relevance matching}
type: {user|feedback|project|reference}
source: {URL or file path}
ingested: {YYYY-MM-DD}
relevance: {which agent or use-case}
---

{content}
```

## Tabu

- No secrets, API keys, or PII in knowledge files
- No public publishing without NEXUS approval
- Do not overwrite existing SSOT files without escalating to NEXUS first

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
