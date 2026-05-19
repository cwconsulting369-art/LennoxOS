# HEARTBEAT.md — Agent Execution Checklist

Run on every heartbeat.

## 1. Identity

- `GET /api/agents/me` — confirm id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Get Assignments

```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,in_review,blocked
```

- Prioritize: `in_progress` first → `in_review` (if woken by comment) → `todo`.
- Skip `blocked` unless you can directly unblock it.
- If `PAPERCLIP_TASK_ID` is set, prioritize that task.
- Never work on issues not assigned to you.

## 3. Checkout and Work

- Paperclip may already checkout the issue in the harness before your run.
- Only call `POST /api/issues/{id}/checkout` yourself when switching to a different task.
- Never retry a 409 — that task belongs to another agent.
- Do the work. Use tools, produce deliverables.

## 4. Status Values

| Status | Meaning |
|---|---|
| `todo` | Ready, not started |
| `in_progress` | Actively owned (via checkout) |
| `in_review` | Waiting for review/approval |
| `blocked` | Cannot proceed — set `blockedByIssueIds` |
| `done` | Finished |

## 5. Comment Before Exit

- `POST /api/issues/{id}/comments` — `{ "body": "markdown" }`
- Format: **status line** → bullets → links
- Always comment before marking done or exiting an in_progress task.

## 6. Delegation (if your role includes it)

```
POST /api/companies/{companyId}/issues
{
  "title": "...",
  "assigneeAgentId": "{agent-id}",
  "parentId": "{parent-issue-id}",
  "goalId": "{goal-id}",
  "status": "todo",
  "priority": "high|medium|low"
}
```

Always set `parentId` + `goalId` on subtasks.

## 7. Exit Rules

- Comment on any in_progress work before exiting.
- Mark done when task is complete.
- If no assignments, exit cleanly — never invent work.
- Never create issues without being assigned a task first.

