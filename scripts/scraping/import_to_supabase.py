"""
Importiert gescrapte Dienstleister-Daten in Supabase service_providers Tabelle.
Nutzt die Supabase REST API (PostgREST) mit dem Service-Role-Key.
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import json
import re
import uuid
import os
import urllib.request
import urllib.error
import time

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
ROOT_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ENV_FILE   = os.path.join(ROOT_DIR, ".env.local")

BATCH_SIZE = 50  # PostgREST Bulk Insert Batch-Groesse


# ─── Env laden ───────────────────────────────────────────────────────────────

def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


# ─── Hilfsfunktionen ────────────────────────────────────────────────────────

def to_slug(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def build_record(p: dict, service_type: str, seen_slugs: set[str]) -> dict:
    """Baut einen Supabase-kompatiblen Datensatz."""
    name = (p.get("name") or "").strip()

    # Slug (eindeutig)
    base = to_slug(name) + f"-{service_type[:4]}"
    slug = base
    counter = 2
    while slug in seen_slugs:
        slug = f"{base}-{counter}"
        counter += 1
    seen_slugs.add(slug)

    return {
        "id":            str(uuid.uuid4()),
        "slug":          slug,
        "name":          name,
        "service_type":  service_type,
        "city_slug":     p.get("city_slug", ""),
        "description":   (p.get("description") or "")[:400],
        "website_url":   p.get("website_url") or None,
        "contact_email": p.get("contact_email") or None,
        "contact_phone": p.get("contact_phone") or None,
        "is_verified":   False,
        "status":        "active",
        "meta": {
            "source":      p.get("source", "web"),
            "source_url":  p.get("source_url", ""),
            "specialization": p.get("specialization") or p.get("specializations") or None,
        },
    }


def post_batch(url: str, key: str, records: list[dict]) -> tuple[int, str]:
    """Sendet einen Batch an Supabase PostgREST. Gibt (status_code, body) zurueck."""
    body = json.dumps(records, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(
        f"{url}/rest/v1/service_providers",
        data=body,
        method="POST",
        headers={
            "apikey":       key,
            "Authorization":f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer":       "resolution=ignore-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def import_file(json_path: str, service_type: str, url: str, key: str, seen_slugs: set[str]) -> int:
    if not os.path.exists(json_path):
        print(f"  Datei nicht gefunden: {json_path}")
        return 0

    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    records = [build_record(p, service_type, seen_slugs) for p in raw]
    total   = len(records)
    inserted = 0

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        status, body = post_batch(url, key, batch)

        if status in (200, 201):
            inserted += len(batch)
            print(f"  Batch {i//BATCH_SIZE + 1}: {len(batch)} eingefuegt (HTTP {status})")
        else:
            print(f"  Batch {i//BATCH_SIZE + 1}: FEHLER HTTP {status}")
            print(f"    {body[:300]}")

        time.sleep(0.3)

    return inserted


def check_count(url: str, key: str) -> str:
    req = urllib.request.Request(
        f"{url}/rest/v1/service_providers?select=count",
        headers={
            "apikey":       key,
            "Authorization":f"Bearer {key}",
            "Accept":       "application/json",
            "Prefer":       "count=exact",
            "Range":        "0-0",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.headers.get("Content-Range", "?")
    except Exception as e:
        return f"Fehler: {e}"


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=== Supabase Import ===\n")

    env = load_env(ENV_FILE)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not key:
        print("FEHLER: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY nicht gefunden.")
        return

    print(f"Supabase URL: {url}")
    print(f"Aktuelle Datensaetze: {check_count(url, key)}\n")

    seen_slugs: set[str] = set()
    total_inserted = 0

    # Moderatoren
    print("--- Moderatoren (moderatoren.org) ---")
    n = import_file(
        os.path.join(OUTPUT_DIR, "moderatoren_clean.json"),
        "moderator", url, key, seen_slugs
    )
    total_inserted += n
    print(f"  => {n} Moderatoren importiert\n")

    # Fotografen
    print("--- Fotografen (allefotografen.de) ---")
    n = import_file(
        os.path.join(OUTPUT_DIR, "fotografen_clean.json"),
        "photography", url, key, seen_slugs
    )
    total_inserted += n
    print(f"  => {n} Fotografen importiert\n")

    print(f"=== Gesamt importiert: {total_inserted} ===")
    print(f"Neue Datensaetze in DB: {check_count(url, key)}")


if __name__ == "__main__":
    main()
