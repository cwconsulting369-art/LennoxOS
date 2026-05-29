#!/usr/bin/env python3
"""
005b_migrate_ideas.py — Airtable "Ideen" (42) + MD-Inbox → LennoxOS ideas-Tabelle.
Idempotent: Airtable via on_conflict=airtable_id (upsert), MD via source_file-Check.
Dedup: SQL-Pass nach Load markiert is_duplicate + duplicate_of.
Run: python3 005b_migrate_ideas.py   (liest creds aus ~/.claude/.env via env)
"""
import os, json, re, glob, hashlib, urllib.request, urllib.error

AIRTABLE_TOKEN = os.environ["AIRTABLE_TOKEN"]
BASE = "appJDdfkdzsIhuSUc"; TABLE = "tblpLr3Tb9AlojdVE"
SUPA = os.environ["LENNOXOS_SUPABASE_URL"].rstrip("/")
KEY = os.environ["LENNOXOS_SUPABASE_SERVICE_ROLE_KEY"]
INBOX = "/home/carlos/personal-os/04-ideas/inbox"

def http(url, headers, data=None, method="GET"):
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

# ── enum maps ──
STATUS = {"Neu":"neu","In Arbeit":"in_arbeit","Erledigt":"erledigt","Verworfen":"verworfen"}
EVAL   = {"Einbauen":"einbauen","On Hold":"on_hold","Verwerfen":"verwerfen","Bereits vorhanden":"vorhanden"}
PRIO   = {"Hoch":"hoch","Mittel":"mittel","Niedrig":"niedrig"}
CAT    = {"Business":"business","Tech":"tech","Marketing":"marketing","Automatisierung":"automatisierung","Finanzen":"finanzen","Sonstiges":"sonstiges"}
PROJ   = {"AEVUM":"aevum","UtilityHub":"utilityhub","LennoxOS":"lennoxos","Ketolabs":"ketolabs","Goldtradersociety":"gts","Keine Zuteilung":"none"}

GARBAGE_RE = re.compile(r"(testidee|test von lennoxos|ideahub live-test|test-idee|hbjhgvf|^monat$|^/menu$|dann-das-naechste-idee)", re.I)

def norm(t):
    t = (t or "").lower().strip()
    t = re.sub(r"[^a-z0-9äöüß ]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t

def dedup_hash(t):
    return hashlib.sha1(norm(t).encode()).hexdigest()[:16]

# ── 1) Airtable fetch (paginate) ──
def fetch_airtable():
    out, offset = [], None
    while True:
        url = f"https://api.airtable.com/v0/{BASE}/{TABLE}?pageSize=100"
        if offset: url += f"&offset={offset}"
        st, body = http(url, {"Authorization": f"Bearer {AIRTABLE_TOKEN}"})
        if st != 200: raise SystemExit(f"airtable {st}: {body[:200]}")
        d = json.loads(body); out += d.get("records", [])
        offset = d.get("offset")
        if not offset: break
    return out

def tags_arr(v):
    if not v: return []
    return [s.strip() for s in re.split(r"[\n,;]+", v) if s.strip()][:20]

def map_record(rec):
    f = rec.get("fields", {})
    title = (f.get("Titel") or "").strip()
    if not title or GARBAGE_RE.search(title): return None
    return {
        "title": title[:500],
        "summary": f.get("Zusammenfassung"),
        "content": f.get("Inhalt"),
        "ai_note": f.get("AI Notiz"),
        "value_add": f.get("Mehrwert"),
        "url": f.get("URL"),
        "tags": tags_arr(f.get("Tags")),
        "status": STATUS.get(f.get("Status"), "neu"),
        "evaluation": EVAL.get(f.get("Bewertung")),
        "priority": PRIO.get(f.get("Priorität")),
        "leverage": PRIO.get(f.get("Hebel")),
        "category": CAT.get(f.get("Kategorie")),
        "project": PROJ.get(f.get("Projekt")),
        "content_type": (f.get("Inhaltstyp") or "").lower() or None,
        "source": (f.get("Quelle") or "").lower().replace(" ", "_") or None,
        "relevance": int(f["Relevanz"]) if isinstance(f.get("Relevanz"), (int, float)) else None,
        "origin": "airtable",
        "airtable_id": rec["id"],
        "dedup_hash": dedup_hash(title),
    }

def upsert(rows, on_conflict=None):
    if not rows: return 0, ""
    url = f"{SUPA}/rest/v1/ideas" + (f"?on_conflict={on_conflict}" if on_conflict else "")
    prefer = ("resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal")
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": prefer}
    st, body = http(url, h, data=json.dumps(rows).encode(), method="POST")
    return st, body

# ── run Airtable ──
recs = fetch_airtable()
mapped = [m for m in (map_record(r) for r in recs) if m]
print(f"Airtable: {len(recs)} fetched → {len(mapped)} nach Garbage-Filter ({len(recs)-len(mapped)} verworfen)")
st, body = upsert(mapped, "airtable_id")
print(f"  upsert status={st} {body[:150]}")

# ── 2) MD-Inbox (origin=md_import) ──
SKIP_RE = re.compile(r"(voicefail|report|audit|^\d{4}-\d{2}-\d{2}-menu)", re.I)
md_rows = []
# vorhandene source_files holen (idempotenz)
st, body = http(f"{SUPA}/rest/v1/ideas?select=source_file&origin=eq.md_import",
                {"apikey": KEY, "Authorization": f"Bearer {KEY}"})
existing = {r["source_file"] for r in json.loads(body)} if st == 200 else set()

for path in sorted(glob.glob(f"{INBOX}/*.md")):
    base = os.path.basename(path)
    if SKIP_RE.search(base) or path in existing: continue
    txt = open(path, encoding="utf-8", errors="ignore").read()
    # Titel: erste # Heading oder frontmatter title oder Dateiname
    m = re.search(r"^#\s+(.+)$", txt, re.M) or re.search(r"^title:\s*(.+)$", txt, re.M)
    title = (m.group(1).strip() if m else re.sub(r"^\d{4}-\d{2}-\d{2}-", "", base[:-3]).replace("-", " ").strip())[:500]
    if not title or GARBAGE_RE.search(title): continue
    url_m = re.search(r"https?://\S+", txt)
    md_rows.append({
        "title": title, "content": txt[:8000], "origin": "md_import",
        "source_file": path, "source": "md_import", "status": "neu",
        "url": url_m.group(0).rstrip(").,") if url_m else None,
        "dedup_hash": dedup_hash(title),
    })
print(f"MD-Inbox: {len(md_rows)} neue (von {len(glob.glob(f'{INBOX}/*.md'))} files, {len(existing)} schon drin)")
if md_rows:
    st, body = upsert(md_rows)
    print(f"  insert status={st} {body[:150]}")

print("Migration done.")
