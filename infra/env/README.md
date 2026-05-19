# LennoxOS Env Management

Zentrale Dokumentation aller API-Keys die LennoxOS-Komponenten brauchen.

## Single Source of Truth (auf VPS)
**Master:** `/home/carlos/.claude/.env` (chmod 600, NIE committen)

Alle Service-`.env` Files werden via `/home/carlos/scripts/sync-env-from-master.py` 
aus dem Master befüllt (nur Keys die im Service schon existieren werden überschrieben).

## Komponenten und ihre Keys

| Komponente | Pfad auf VPS | Braucht Keys aus |
|---|---|---|
| LennoxOS Dashboard | `/home/carlos/lennox-os/` | `.env` (Supabase, DB) |
| agent-core (Lennox-Bot) | `/home/carlos/services/agent-core/` | `TG_LENNOX_BOT_TOKEN`, `OPENROUTER_API_KEY` |
| Paperclip Instructions | n/a (read-only docs) | — |
| Dropzone Watcher | `/home/carlos/services/dropzone-watcher/` | nutzt agent-core .env |

## Templates

Siehe `.env.example` Files pro Komponente in ihren jeweiligen Folders.

## Rotation

Bei Token-Rotation:
1. Neuer Wert in `~/.claude/.env`
2. `python3 ~/scripts/sync-env-from-master.py`
3. Affected Services per `pm2 restart <name>` neu starten

## ⚠️ Niemals committen

Alle echten `.env` sind in `.gitignore`. Nur `.env.example` mit leeren Templates gehört in git.
