"""
Bereinigt und dedupliziert die gescrapten Daten.
Generiert finale SQL INSERT Statements für service_providers.
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import json
import re
import uuid
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


# ─── Hilfsfunktionen ────────────────────────────────────────────────────────

def to_slug(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def clean_moderator_name(raw: str) -> str:
    """Entfernt Präfixe wie 'Business-Profi', 'Tech-Profi' etc. aus den Namen."""
    # z.B. "Business-ProfiPetra Bindl" → "Petra Bindl"
    # z.B. "Cybersecurity ProfiFerry van Saalbach" → "Ferry van Saalbach"
    # z.B. "Christiane Stein" → unverändert
    raw = raw.strip().rstrip(":")

    # Entferne bekannte Präfixe
    cleaned = re.sub(
        r"^[\w\-\s]+Profi\s*:?\s*",  # "Business-Profi", "Tech Profi", "Profi" etc.
        "",
        raw,
        flags=re.IGNORECASE
    )
    cleaned = cleaned.strip()

    # Falls "Profi" im Namen vorkommt ohne Leerzeichen (z.B. "Business-ProfiPetra")
    # → Trennung an Großbuchstaben nach "Profi"
    if not cleaned or len(cleaned.split()) < 1:
        match = re.search(r"Profi([A-ZÄÖÜ][\w\s\-\.]+)", raw)
        if match:
            cleaned = match.group(1).strip()

    # Falls immer noch leer oder zu kurz → original zurück
    if len(cleaned.strip()) < 3:
        cleaned = raw

    return cleaned.strip()


def is_valid_name(name: str) -> bool:
    """Prüft ob ein Name wie ein echter Personenname aussieht."""
    if not name or len(name) < 4:
        return False
    # Muss mindestens 2 Teile haben
    parts = name.split()
    if len(parts) < 1:
        return False
    # Keine generischen Seiten-Titel
    bad = [
        "Premium Plus", "Moderation", "Netzwerk für gute", "Regionale Zuordnung",
        "Kompetenzbereiche", "Bitte wählen", "Moderator buchen", "Moderatorin buchen",
    ]
    for b in bad:
        if b.lower() in name.lower():
            return False
    return True


def deduplicate(entries: list[dict], key_fn) -> list[dict]:
    """Entfernt Duplikate basierend auf einer key-Funktion (behält ersten Treffer)."""
    seen = set()
    result = []
    for e in entries:
        k = key_fn(e)
        if k not in seen:
            seen.add(k)
            result.append(e)
    return result


def sql_escape(s: str) -> str:
    return (s or "").replace("'", "''").replace("\x00", "")


def generate_sql(entries: list[dict], service_type: str) -> str:
    if not entries:
        return f"-- Keine {service_type} Datensätze\n"

    rows = []
    seen_slugs: dict[str, int] = {}

    for p in entries:
        pid = str(uuid.uuid4())

        # Slug
        base_slug = to_slug(p["name"]) + f"-{service_type[:4]}"
        slug = base_slug
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{base_slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        name      = sql_escape(p.get("name", ""))
        desc      = sql_escape(p.get("description", ""))[:400]
        website   = sql_escape(p.get("website_url", ""))
        email     = sql_escape(p.get("contact_email", ""))
        phone     = sql_escape(p.get("contact_phone", ""))
        city      = sql_escape(p.get("city_slug", ""))
        stype     = sql_escape(service_type)
        src_url   = sql_escape(p.get("source_url", ""))
        source    = sql_escape(p.get("source", "web"))

        meta_dict = {
            "source": source,
            "source_url": src_url,
        }
        if p.get("specialization"):
            meta_dict["specialization"] = p["specialization"]
        if p.get("specializations"):
            meta_dict["specializations"] = p["specializations"]
        if p.get("all_cities_mentioned"):
            meta_dict["all_cities_mentioned"] = p["all_cities_mentioned"]

        meta = sql_escape(json.dumps(meta_dict, ensure_ascii=False))

        rows.append(
            f"  ('{pid}', '{slug}', '{name}', '{stype}', '{city}', "
            f"'{desc}', '{website}', '{email}', '{phone}', "
            f"false, 'active', '{meta}'::jsonb)"
        )

    header = (
        f"-- Generiert von cleanup_and_export.py\n"
        f"-- {len(rows)} {service_type} Datensätze\n\n"
        f"INSERT INTO service_providers\n"
        f"  (id, slug, name, service_type, city_slug, description, website_url,\n"
        f"   contact_email, contact_phone, is_verified, status, meta)\n"
        f"VALUES\n"
    )
    return header + ",\n".join(rows) + "\nON CONFLICT (slug) DO NOTHING;\n"


# ─── Moderatoren bereinigen ──────────────────────────────────────────────────

def process_moderatoren() -> list[dict]:
    path = os.path.join(OUTPUT_DIR, "moderatoren.json")
    if not os.path.exists(path):
        print("moderatoren.json nicht gefunden, überspringe.")
        return []

    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    print(f"Moderatoren roh: {len(raw)}")

    cleaned = []
    for p in raw:
        name = clean_moderator_name(p.get("name", ""))
        if not is_valid_name(name):
            continue

        p["name"] = name
        p["source"] = "moderatoren.org"
        cleaned.append(p)

    # Deduplizieren: pro Person nur einen Eintrag pro Stadt
    deduped = deduplicate(cleaned, lambda p: (p["name"].lower(), p["city_slug"]))

    print(f"Moderatoren nach Bereinigung: {len(deduped)}")
    by_city: dict[str, int] = {}
    for p in deduped:
        by_city[p["city_slug"]] = by_city.get(p["city_slug"], 0) + 1
    for city, count in sorted(by_city.items()):
        print(f"  {city}: {count}")

    return deduped


# ─── Fotografen bereinigen ───────────────────────────────────────────────────

def process_fotografen() -> list[dict]:
    path = os.path.join(OUTPUT_DIR, "fotografen.json")
    if not os.path.exists(path):
        print("fotografen.json nicht gefunden, überspringe.")
        return []

    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    print(f"Fotografen roh: {len(raw)}")

    cleaned = []
    for p in raw:
        name = (p.get("name") or "").strip()
        if not name or len(name) < 2:
            continue

        # Google Maps Links als website_url entfernen
        if "google.com/maps" in (p.get("website_url") or ""):
            p["website_url"] = ""

        # Nur Einträge mit mindestens Telefon oder Name (alle haben zumindest Namen)
        p["source"] = "allefotografen.de"
        cleaned.append(p)

    # Deduplizieren: Name + Stadt
    deduped = deduplicate(cleaned, lambda p: (p["name"].lower(), p["city_slug"]))

    print(f"Fotografen nach Bereinigung: {len(deduped)}")
    by_city: dict[str, int] = {}
    for p in deduped:
        by_city[p["city_slug"]] = by_city.get(p["city_slug"], 0) + 1
    for city, count in sorted(by_city.items()):
        print(f"  {city}: {count}")

    return deduped


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print("=== Cleanup & SQL-Export ===\n")

    moderatoren = process_moderatoren()
    print()
    fotografen  = process_fotografen()

    # Bereinigte JSONs speichern
    mod_clean_path = os.path.join(OUTPUT_DIR, "moderatoren_clean.json")
    foto_clean_path = os.path.join(OUTPUT_DIR, "fotografen_clean.json")

    with open(mod_clean_path, "w", encoding="utf-8") as f:
        json.dump(moderatoren, f, ensure_ascii=False, indent=2)

    with open(foto_clean_path, "w", encoding="utf-8") as f:
        json.dump(fotografen, f, ensure_ascii=False, indent=2)

    # SQL generieren
    mod_sql  = generate_sql(moderatoren, "moderator")
    foto_sql = generate_sql(fotografen,  "photography")

    mod_sql_path  = os.path.join(OUTPUT_DIR, "moderatoren_final.sql")
    foto_sql_path = os.path.join(OUTPUT_DIR, "fotografen_final.sql")

    with open(mod_sql_path, "w", encoding="utf-8") as f:
        f.write(mod_sql)

    with open(foto_sql_path, "w", encoding="utf-8") as f:
        f.write(foto_sql)

    print(f"\nDateien gespeichert:")
    print(f"  {mod_clean_path}")
    print(f"  {foto_clean_path}")
    print(f"  {mod_sql_path}")
    print(f"  {foto_sql_path}")

    total = len(moderatoren) + len(fotografen)
    print(f"\nGesamt: {total} Datensätze bereit für Supabase Import")
    print(f"  - {len(moderatoren)} Moderatoren")
    print(f"  - {len(fotografen)} Fotografen")


if __name__ == "__main__":
    main()
