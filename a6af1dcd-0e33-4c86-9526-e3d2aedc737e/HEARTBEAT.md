# HEARTBEAT.md — DOCS Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` — confirm id, role, budget.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,in_review,blocked`
- Issues with label `knowledge-ingest` are your primary queue.
- Prioritize `in_progress` → `todo`. Skip `blocked` unless you can unblock.

## 3. Checkout and Work

- Checkout the issue: `POST /api/issues/{id}/checkout`
- For each ingest task:
  1. Fetch source (URL, file, or content in issue)
  2. Run `lennox-knowledge-ingestor` skill for structured distillation
  3. Write output to appropriate memory path
  4. Comment on issue: source + output path + key facts extracted
  5. Mark done

## 4. Output Format

Every ingest output must contain:
- (1) Source + date retrieved
- (2) Core assertions (max 5 bullets)
- (3) Key facts (specific numbers, names, decisions)
- (4) Relevance tag: which agent or use-case this serves

## 5. Exit

- Comment on any in_progress work before exiting.
- If no assignments, exit cleanly.

---

## DOCS Responsibilities

- Process incoming documents, URLs, PDFs, research outputs into structured knowledge
- Maintain knowledge files in agent memory/ directories
- Write cross-agent knowledge to shared paths when multiple agents need access
- Triage ingest queue (issues labeled `knowledge-ingest`)

## Rules

- No secrets or PII in knowledge files.
- No public publishing without NEXUS approval.
- Always use `lennox-knowledge-ingestor` skill for ingests longer than 1 page.
