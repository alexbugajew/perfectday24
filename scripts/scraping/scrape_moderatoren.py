"""
Scraper für moderatoren.org
Sammelt Moderatoren-Profile für die größten deutschen Städte.
Output: JSON + SQL INSERT für service_providers Tabelle.
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import uuid
import os

BASE_URL = "https://www.moderatoren.org"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
}

# Stadt → (URL-Slug, pd24 city_slug)
CITIES = {
    "Berlin":      ("berlin-deutschland",      "berlin-berlin"),
    "Hamburg":     ("hamburg-deutschland",      "hamburg-hamburg"),
    "München":     ("muenchen-deutschland",     "muenchen-muenchen"),
    "Köln":        ("koeln-deutschland",        "koeln-koeln"),
    "Frankfurt":   ("frankfurt-deutschland",    "frankfurt-frankfurt"),
    "Stuttgart":   ("stuttgart-deutschland",    "stuttgart-stuttgart"),
    "Düsseldorf":  ("duesseldorf-deutschland",  "duesseldorf-duesseldorf"),
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def decode_cf_email(encoded: str) -> str:
    """Dekodiert Cloudflare-geschützte E-Mail-Adressen."""
    try:
        r = int(encoded[:2], 16)
        return "".join(chr(int(encoded[i:i+2], 16) ^ r) for i in range(2, len(encoded), 2))
    except Exception:
        return ""


def to_slug(name: str) -> str:
    """Erstellt einen URL-kompatiblen Slug aus einem Namen."""
    s = name.lower().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def get_profile_urls_for_city(city_label: str, city_url_slug: str) -> list[str]:
    """Holt alle Profil-URLs von der Stadtseite."""
    url = f"{BASE_URL}/moderator-buchen-{city_url_slug}/"
    print(f"  Listing: {url}")
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"    FEHLER beim Abrufen: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    profile_urls = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Profilseiten: direkt unter /, kein Unterordner, kein Admin
        if href.startswith("/") and href.count("/") == 2 and not any(
            x in href for x in ["moderator-buchen", "moderatoren-", "wp-", "admin", "#", "?"]
        ):
            profile_urls.add(BASE_URL + href)
        elif href.startswith(BASE_URL + "/") and href.rstrip("/").count("/") == 4:
            profile_urls.add(href)

    print(f"    -> {len(profile_urls)} Profile gefunden")
    return sorted(profile_urls)


def parse_profile(url: str, city_slug: str) -> dict | None:
    """Parst eine Moderatoren-Profilseite und extrahiert alle relevanten Felder."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code in (404, 410):
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"    FEHLER {url}: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Name: steht in h3, meist als "Rolle **Vorname Nachname**:"
    # Struktur: <h3>Business-Profi <strong>Petra Bindl</strong>:</h3>
    name = ""
    for h3 in soup.find_all("h3"):
        strong = h3.find("strong")
        if strong:
            candidate = strong.get_text(strip=True)
            # Muss mindestens zwei Wörter haben und kein generisches "buchen" enthalten
            if len(candidate.split()) >= 2 and "buchen" not in candidate.lower():
                name = candidate.rstrip(":").strip()
                break
        else:
            # Fallback: ganzer h3-Text wenn er wie ein Name aussieht
            text = h3.get_text(strip=True).rstrip(":")
            parts = text.split()
            if len(parts) >= 2 and not any(x in text.lower() for x in ["buchen", "moderator", "moderatorin", "engagieren"]):
                name = text
                break

    # Kein echter Name gefunden → Kategorie-Seite überspringen
    if not name or len(name.split()) < 2:
        return None

    # E-Mail (Cloudflare-geschützt)
    email = ""
    for cf_span in soup.find_all("span", class_="__cf_email__"):
        encoded = cf_span.get("data-cfemail", "")
        if encoded:
            email = decode_cf_email(encoded)
            break
    if not email:
        mailto = soup.find("a", href=re.compile(r"^mailto:"))
        if mailto:
            email = mailto["href"].replace("mailto:", "").strip()

    # Website (keine sozialen Netzwerke, keine moderatoren.org-Links)
    skip_domains = ["moderatoren.org", "facebook", "instagram", "twitter", "linkedin", "youtube", "xing", "google"]
    website = ""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("http") and not any(d in href for d in skip_domains):
            website = href
            break

    # Beschreibung / Bio
    description = ""
    for selector in ["div.entry-content", "div.post-content", "article", "main"]:
        content_div = soup.select_one(selector)
        if content_div:
            paragraphs = [p.get_text(strip=True) for p in content_div.find_all("p") if len(p.get_text(strip=True)) > 40]
            if paragraphs:
                description = " ".join(paragraphs[:2])[:400]
                break

    # Spezialisierung aus URL-Slug
    slug_part = url.rstrip("/").split("/")[-1]
    name_slug = to_slug(name)
    specialization = slug_part.replace(name_slug, "").strip("-").replace("-", " ").title()

    # Erwähnte Städte im Profil
    page_text = soup.get_text()
    mentioned_cities = [
        city for city in ["Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig"]
        if city in page_text
    ]

    return {
        "name": name,
        "city_slug": city_slug,
        "all_cities_mentioned": mentioned_cities,
        "website_url": website,
        "contact_email": email,
        "description": description or f"Professionelle Moderation – {specialization}",
        "service_type": "moderator",
        "source_url": url,
        "slug_hint": slug_part,
        "specialization": specialization,
    }


def scrape_all() -> list[dict]:
    all_profiles: list[dict] = []
    seen_urls: set[str] = set()

    for city_label, (city_url_slug, pd24_slug) in CITIES.items():
        print(f"\n=== {city_label} ===")
        profile_urls = get_profile_urls_for_city(city_label, city_url_slug)

        for url in profile_urls:
            if url in seen_urls:
                print(f"    [skip] {url} (bereits verarbeitet)")
                continue
            seen_urls.add(url)

            print(f"  Profil: {url}")
            profile = parse_profile(url, pd24_slug)
            if profile:
                all_profiles.append(profile)
                print(f"    OK {profile['name']} | {profile['contact_email'] or '(keine E-Mail)'}")
            time.sleep(1.2)

    return all_profiles


def to_sql_inserts(profiles: list[dict]) -> str:
    lines = [
        "-- Generiert von scrape_moderatoren.py",
        "-- Importieren via Supabase SQL Editor",
        "",
        "INSERT INTO service_providers (id, slug, name, service_type, city_slug, description, website_url, contact_email, is_verified, status, meta)",
        "VALUES",
    ]

    rows = []
    for p in profiles:
        pid = str(uuid.uuid4())
        slug = to_slug(p["name"]) + "-moderator"
        name = p["name"].replace("'", "''")
        desc = (p["description"] or "").replace("'", "''")
        website = (p["website_url"] or "").replace("'", "''")
        email = (p["contact_email"] or "").replace("'", "''")
        city = p["city_slug"]
        meta = json.dumps({
            "source": "moderatoren.org",
            "source_url": p["source_url"],
            "specialization": p["specialization"],
            "all_cities_mentioned": p["all_cities_mentioned"],
        }).replace("'", "''")

        rows.append(
            f"  ('{pid}', '{slug}', '{name}', 'moderator', '{city}', '{desc}', "
            f"'{website}', '{email}', false, 'active', '{meta}'::jsonb)"
        )

    lines.append(",\n".join(rows) + ";")
    return "\n".join(lines)


def main():
    print("=== moderatoren.org Scraper ===\n")
    profiles = scrape_all()

    print(f"\n=== Ergebnis: {len(profiles)} Profile ===\n")

    # JSON speichern
    json_path = os.path.join(OUTPUT_DIR, "moderatoren.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=2)
    print(f"JSON gespeichert: {json_path}")

    # SQL speichern
    sql_path = os.path.join(OUTPUT_DIR, "moderatoren.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(to_sql_inserts(profiles))
    print(f"SQL gespeichert:  {sql_path}")

    # Kurzübersicht
    print("\n--- Übersicht ---")
    by_city: dict[str, int] = {}
    for p in profiles:
        by_city[p["city_slug"]] = by_city.get(p["city_slug"], 0) + 1
    for city, count in sorted(by_city.items()):
        print(f"  {city}: {count}")


if __name__ == "__main__":
    main()
