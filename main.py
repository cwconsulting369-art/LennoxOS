#!/usr/bin/env python3
"""
Lennox Agent Core v1
Telegram (LENNOX bot) → OpenRouter tool-use → VPS filesystem/exec
"""
import os, json, asyncio, subprocess, logging, urllib.request
from pathlib import Path
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
TOKEN = os.environ["TG_LENNOX_BOT_TOKEN"]
OR_KEY = os.environ["OPENROUTER_API_KEY"]
ALLOWED_ID = int(os.environ.get("ALLOWED_CHAT_ID", "6436074677"))
OR_BASE = "https://openrouter.ai/api/v1"
COMPANY_ID = "7b5160b6-fd57-44b9-a3ba-f989e15a8597"
PAPERCLIP_URL = "http://localhost:3100"
INSTRUCTIONS_BASE = Path(f"/home/carlos/.paperclip/instances/default/storage/companies/{COMPANY_ID}/agents")

AGENTS = {
    "nexus":      {"id": "12fe6801-c9e1-4a2b-aa0a-01c38ac69496", "model": "anthropic/claude-sonnet-4-5"},
    "pmo":        {"id": "a60ce9d1-d8d9-4607-9ef2-eb3903f5ecc8", "model": "anthropic/claude-haiku-4-5"},
    "coder":      {"id": "2d380d93-58d5-4536-9ea6-5200ec7185cd", "model": "anthropic/claude-sonnet-4-5"},
    "researcher": {"id": "d0de4dce-2cb9-4ff1-9c4b-cc66b00081ed", "model": "anthropic/claude-sonnet-4-5"},
    "operator":   {"id": "5ada4e4b-7e80-49e5-9254-146df3440f75", "model": "anthropic/claude-haiku-4-5"},
    "docs":       {"id": "a6af1dcd-0e33-4c86-9526-e3d2aedc737e", "model": "anthropic/claude-haiku-4-5"},
}

# ── Session state ──────────────────────────────────────────────────────────────
sessions: dict[int, dict] = {}

def get_session(chat_id: int) -> dict:
    if chat_id not in sessions:
        sessions[chat_id] = {"agent": "nexus", "messages": []}
    return sessions[chat_id]

# ── Agent system prompt ────────────────────────────────────────────────────────
def load_system(agent_name: str) -> str:
    agent_id = AGENTS[agent_name]["id"]
    parts = []
    for fname in ["AGENTS.md", "SOUL.md", "TOOLS.md"]:
        f = INSTRUCTIONS_BASE / agent_id / "instructions" / fname
        if f.exists():
            parts.append(f.read_text())
    if not parts:
        return f"You are {agent_name.upper()}, an autonomous AI agent for LennoxOS (VPS: 204.168.142.89). Be direct and execute tasks using available tools."
    return "\n\n---\n\n".join(parts)

# ── Tools definition ───────────────────────────────────────────────────────────
TOOLS = [
    {"type": "function", "function": {
        "name": "read_file",
        "description": "Read file content from VPS filesystem",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string", "description": "Path (supports ~)"}
        }, "required": ["path"]}
    }},
    {"type": "function", "function": {
        "name": "write_file",
        "description": "Write or append to file on VPS. Creates parent dirs.",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "content": {"type": "string"},
            "append": {"type": "boolean", "default": False}
        }, "required": ["path", "content"]}
    }},
    {"type": "function", "function": {
        "name": "execute_command",
        "description": "Run shell command on VPS. Returns stdout+stderr.",
        "parameters": {"type": "object", "properties": {
            "command": {"type": "string"},
            "cwd": {"type": "string", "description": "Working directory (optional)"},
            "timeout": {"type": "integer", "description": "Timeout seconds, default 30"}
        }, "required": ["command"]}
    }},
    {"type": "function", "function": {
        "name": "pm2_action",
        "description": "Manage pm2 processes: list, restart, stop, start, logs, save",
        "parameters": {"type": "object", "properties": {
            "action": {"type": "string", "enum": ["list", "restart", "stop", "start", "logs", "save"]},
            "name": {"type": "string", "description": "Process name (required for restart/stop/start/logs)"},
            "lines": {"type": "integer", "description": "Log lines (default 50)"}
        }, "required": ["action"]}
    }},
    {"type": "function", "function": {
        "name": "git_commit",
        "description": "Stage all + commit in git repo. Optionally push.",
        "parameters": {"type": "object", "properties": {
            "repo_path": {"type": "string"},
            "message": {"type": "string"},
            "push": {"type": "boolean", "default": False}
        }, "required": ["repo_path", "message"]}
    }},
    {"type": "function", "function": {
        "name": "list_directory",
        "description": "List directory contents (ls -la or find)",
        "parameters": {"type": "object", "properties": {
            "path": {"type": "string"},
            "recursive": {"type": "boolean", "default": False}
        }, "required": ["path"]}
    }},
    {"type": "function", "function": {
        "name": "create_issue",
        "description": "Create a Paperclip issue (LEN-*). Assign to agent if needed.",
        "parameters": {"type": "object", "properties": {
            "title": {"type": "string"},
            "description": {"type": "string", "default": ""},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "default": "medium"},
            "agent": {"type": "string", "description": "Agent name to assign: nexus/pmo/coder/researcher/operator/docs"}
        }, "required": ["title"]}
    }},
    {"type": "function", "function": {
        "name": "list_issues",
        "description": "List open Paperclip issues",
        "parameters": {"type": "object", "properties": {
            "status": {"type": "string", "default": "open"},
            "limit": {"type": "integer", "default": 20}
        }}
    }},
]

# ── Tool execution ─────────────────────────────────────────────────────────────
NVM_PATH = "export PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$HOME/.local/bin:$PATH; "

def xp(p: str) -> str:
    return str(Path(p).expanduser())

def tool_read_file(path: str) -> str:
    try:
        p = Path(xp(path))
        if not p.exists():
            return f"ERROR: not found: {path}"
        if p.stat().st_size > 200_000:
            return f"ERROR: too large ({p.stat().st_size}b). Use execute_command head/tail/grep."
        return p.read_text(errors="replace")
    except Exception as e:
        return f"ERROR: {e}"

def tool_write_file(path: str, content: str, append: bool = False) -> str:
    try:
        p = Path(xp(path))
        p.parent.mkdir(parents=True, exist_ok=True)
        mode = "a" if append else "w"
        with p.open(mode) as f:
            f.write(content)
        return f"OK: {'appended' if append else 'written'} {path} ({len(content)}c)"
    except Exception as e:
        return f"ERROR: {e}"

def tool_execute_command(command: str, cwd: str = None, timeout: int = 60) -> str:
    try:
        result = subprocess.run(
            NVM_PATH + command, shell=True, capture_output=True, text=True,
            cwd=xp(cwd) if cwd else "/home/carlos", timeout=timeout
        )
        out = (result.stdout + result.stderr).strip()
        if len(out) > 3000:
            out = out[:1500] + "\n...[truncated]...\n" + out[-1000:]
        return f"[exit {result.returncode}]\n{out}" if result.returncode != 0 else out or "(empty output)"
    except subprocess.TimeoutExpired:
        return f"ERROR: timeout after {timeout}s"
    except Exception as e:
        return f"ERROR: {e}"

def tool_pm2_action(action: str, name: str = None, lines: int = 50) -> str:
    if action == "list": return tool_execute_command("pm2 list --no-color")
    if action == "save": return tool_execute_command("pm2 save")
    if action == "logs" and name: return tool_execute_command(f"pm2 logs {name} --lines {lines} --nostream --no-color")
    if action in ("restart", "stop", "start") and name: return tool_execute_command(f"pm2 {action} {name}")
    return "ERROR: invalid action or missing name"

def tool_git_commit(repo_path: str, message: str, push: bool = False) -> str:
    p = xp(repo_path)
    cmd = f"cd {p} && git add -A && git commit -m \"{message}\""
    if push:
        cmd += " && git push"
    return tool_execute_command(cmd)

def tool_list_directory(path: str, recursive: bool = False) -> str:
    p = xp(path)
    if recursive:
        return tool_execute_command(f"find {p} -maxdepth 3 2>/dev/null | head -100")
    return tool_execute_command(f"ls -la {p}")

def tool_create_issue(title: str, description: str = "", priority: str = "medium", agent: str = None) -> str:
    payload = {"title": title, "description": description, "priority": priority}
    if agent and agent in AGENTS:
        payload["assignedAgentId"] = AGENTS[agent]["id"]
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues",
        data=data, method="POST",
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read())
            num = res.get("issueNumber", res.get("id", "?"))
            return f"Created LEN-{num}: {title}"
    except Exception as e:
        return f"ERROR: {e}"

def tool_list_issues(status: str = "open", limit: int = 20) -> str:
    url = f"{PAPERCLIP_URL}/api/companies/{COMPANY_ID}/issues?status={status}&limit={limit}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
            issues = data.get("issues", data) if isinstance(data, dict) else data
            if not issues:
                return "No issues found"
            lines = [f"LEN-{i.get('issueNumber','?')}: [{i.get('priority','?')}] {i.get('title','?')} ({i.get('status','?')})"
                     for i in issues[:limit]]
            return "\n".join(lines)
    except Exception as e:
        return f"ERROR: {e}"

def run_tool(name: str, args: dict) -> str:
    log.info(f"TOOL {name}: {str(args)[:150]}")
    match name:
        case "read_file":        return tool_read_file(**args)
        case "write_file":       return tool_write_file(**args)
        case "execute_command":  return tool_execute_command(**args)
        case "pm2_action":       return tool_pm2_action(**args)
        case "git_commit":       return tool_git_commit(**args)
        case "list_directory":   return tool_list_directory(**args)
        case "create_issue":     return tool_create_issue(**args)
        case "list_issues":      return tool_list_issues(**args)
        case _:                  return f"ERROR: unknown tool {name}"

# ── OpenRouter agentic loop ────────────────────────────────────────────────────
async def run_agent(chat_id: int, user_msg: str, status_cb) -> str:
    session = get_session(chat_id)
    agent_name = session["agent"]
    model = AGENTS[agent_name]["model"]
    system = load_system(agent_name)

    session["messages"].append({"role": "user", "content": user_msg})
    messages = session["messages"][-24:]

    for i in range(12):  # max 12 tool rounds
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{OR_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {OR_KEY}", "HTTP-Referer": "https://lennoxos.com", "X-Title": "LennoxAgentCore"},
                json={"model": model, "messages": [{"role": "system", "content": system}] + messages,
                      "tools": TOOLS, "tool_choice": "auto", "max_tokens": 4096}
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        msg = choice["message"]
        messages.append(msg)

        if choice["finish_reason"] == "tool_calls" and msg.get("tool_calls"):
            tool_results = []
            for tc in msg["tool_calls"]:
                fn = tc["function"]["name"]
                args = json.loads(tc["function"]["arguments"])
                await status_cb(f"⚙️ `{agent_name.upper()}` → `{fn}`")
                result = run_tool(fn, args)
                tool_results.append({"role": "tool", "tool_call_id": tc["id"], "content": result})
            messages.extend(tool_results)
            continue

        session["messages"] = messages
        return msg.get("content") or "(no response)"

    session["messages"] = messages
    return "Reached max tool iterations."

# ── Telegram handlers ──────────────────────────────────────────────────────────
def auth(update: Update) -> bool:
    return update.effective_chat.id == ALLOWED_ID

async def send_safe(func, text: str, **kwargs):
    try:
        return await func(text, parse_mode="Markdown", **kwargs)
    except Exception:
        return await func(text, **kwargs)

async def cmd_start(update: Update, ctx):
    if not auth(update): return
    await update.message.reply_text(
        "*Lennox Agent Core v1*\n\n"
        "Agents: nexus (default), coder, researcher, operator, pmo, docs\n\n"
        "/agent `<name>` — switch agent\n"
        "/clear — reset history\n"
        "/status — pm2 + session info\n"
        "/issue `<title>` — quick create LEN-issue\n"
        "/issues — list open issues",
        parse_mode="Markdown"
    )

async def cmd_agent(update: Update, ctx):
    if not auth(update): return
    name = (ctx.args[0].lower() if ctx.args else "")
    if name not in AGENTS:
        await update.message.reply_text(f"Available: {', '.join(AGENTS.keys())}")
        return
    s = get_session(update.effective_chat.id)
    s["agent"] = name
    s["messages"] = []
    await update.message.reply_text(f"✅ Switched to *{name.upper()}* (history cleared)", parse_mode="Markdown")

async def cmd_clear(update: Update, ctx):
    if not auth(update): return
    cid = update.effective_chat.id
    agent = get_session(cid).get("agent", "nexus")
    sessions[cid] = {"agent": agent, "messages": []}
    await update.message.reply_text("🧹 Cleared")

async def cmd_status(update: Update, ctx):
    if not auth(update): return
    s = get_session(update.effective_chat.id)
    pm2 = tool_execute_command("pm2 list --no-color")
    text = f"*Agent:* {s['agent'].upper()}\n*History:* {len(s['messages'])} msgs\n\n```\n{pm2[:2000]}\n```"
    await send_safe(update.message.reply_text, text)

async def cmd_issue(update: Update, ctx):
    if not auth(update): return
    title = " ".join(ctx.args) if ctx.args else ""
    if not title:
        await update.message.reply_text("Usage: /issue <title>")
        return
    await update.message.reply_text(tool_create_issue(title))

async def cmd_issues(update: Update, ctx):
    if not auth(update): return
    await update.message.reply_text(tool_list_issues())

async def handle_message(update: Update, ctx):
    if not auth(update): return
    text = update.message.text
    s = get_session(update.effective_chat.id)
    status = await update.message.reply_text(f"⏳ `{s['agent'].upper()}` thinking...", parse_mode="Markdown")

    async def update_status(msg: str):
        try:
            await status.edit_text(msg, parse_mode="Markdown")
        except Exception:
            pass

    try:
        result = await run_agent(update.effective_chat.id, text, update_status)
        chunks = [result[i:i+4000] for i in range(0, max(len(result), 1), 4000)]
        await send_safe(status.edit_text, chunks[0])
        for chunk in chunks[1:]:
            await send_safe(update.message.reply_text, chunk)
    except Exception as e:
        log.exception("Agent error")
        await status.edit_text(f"❌ `{type(e).__name__}: {str(e)[:200]}`", parse_mode="Markdown")

def main():
    app = Application.builder().token(TOKEN).build()
    for cmd, handler in [
        ("start", cmd_start), ("agent", cmd_agent), ("clear", cmd_clear),
        ("status", cmd_status), ("issue", cmd_issue), ("issues", cmd_issues)
    ]:
        app.add_handler(CommandHandler(cmd, handler))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    log.info(f"Agent Core started — {len(AGENTS)} agents")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()

# ── Policy enforcement ─────────────────────────────────────────────────────────
# Hard limits (edit here to adjust):
# - max_tokens=4096 per LLM call (line 250)
# - max 12 tool rounds per user message (range(12) in run_agent)
# - 1 message at a time per chat (Telegram polling, single user)
# - OpenRouter hard limit: set at openrouter.ai/settings → Credit limit
# Monthly OpenRouter cost estimate at max usage:
#   Sonnet @ /MTok: 12 tools * 4k tok * 30 msg/day = ~3/Mo (max)
#   Haiku  @ /bin/bash.25/MTok: same = ~.60/Mo
# In practice: idle messages are much cheaper (~/bin/bash.02-0.05 each)
