"""
Scraper für allefotografen.de
Sammelt Fotografen-Profile für die größten deutschen Städte.
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

BASE_URL = "https://www.allefotografen.de"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
    "Referer": "https://www.allefotografen.de/",
}

# Stadt → (URL-Slug, pd24 city_slug)
CITIES = {
    "Berlin":      ("berlin",           "berlin-berlin"),
    "Hamburg":     ("hamburg",          "hamburg-hamburg"),
    "München":     ("muenchen",         "muenchen-muenchen"),
    "Köln":        ("koeln",            "koeln-koeln"),
    "Frankfurt":   ("frankfurt-am-main","frankfurt-frankfurt"),
    "Stuttgart":   ("stuttgart",        "stuttgart-stuttgart"),
    "Düsseldorf":  ("duesseldorf",      "duesseldorf-duesseldorf"),
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# Nur Geschäfts-/Studioaccounts (keine Einzelpersonen ohne Unternehmensname)
# Wir filtern: muss ein Website-Feld ODER eine E-Mail haben
MIN_COMPLETENESS = 1  # mind. 1 Kontaktfeld


def decode_cf_email(encoded: str) -> str:
    try:
        r = int(encoded[:2], 16)
        return "".join(chr(int(encoded[i:i+2], 16) ^ r) for i in range(2, len(encoded), 2))
    except Exception:
        return ""


def to_slug(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def get_profile_urls_for_city(city_label: str, city_url_slug: str) -> list[str]:
    """Holt alle Profil-URLs für eine Stadt (mit Pagination)."""
    profile_urls: set[str] = set()
    page = 1

    while True:
        if page == 1:
            url = f"{BASE_URL}/fotografen-in-{city_url_slug}"
        else:
            url = f"{BASE_URL}/fotografen-in-{city_url_slug}/seite/{page}"

        print(f"  Listing Seite {page}: {url}")
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 404:
                break
            resp.raise_for_status()
        except Exception as e:
            print(f"    FEHLER: {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        # Profil-Links sammeln — absolute URLs wie https://www.allefotografen.de/username
        found_on_page = 0
        excluded = {
            "fotografen-in", "suche", "login", "register", "datenschutz",
            "impressum", "agb", "kontakt", "wp-", "admin", "page", "seite",
            "kategorie", "hochzeit", "portrait", "event", "business", "#", "?"
        }
        for a in soup.find_all("a", href=True):
            href = a["href"].rstrip("/")
            # Absolute URL mit genau einem Pfadsegment nach der Domain
            if (href.startswith(BASE_URL + "/") and
                href.count("/") == 3 and
                not any(x in href for x in excluded)):
                if href not in profile_urls:
                    profile_urls.add(href)
                    found_on_page += 1

        if found_on_page == 0:
            break

        # Nächste Seite nur wenn Pagination-Link vorhanden
        next_link = soup.find("a", string=re.compile(r"(weiter|nächste|›|»)", re.I))
        if not next_link:
            break

        page += 1
        time.sleep(1.0)

    print(f"    -> {len(profile_urls)} Profile gefunden")
    return sorted(profile_urls)


def parse_profile(url: str, city_slug: str) -> dict | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code in (404, 410):
            return None
        resp.raise_for_status()
    except Exception as e:
        print(f"    FEHLER {url}: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Name
    name = ""
    for tag in ["h1", "h2"]:
        el = soup.find(tag)
        if el:
            name = el.get_text(strip=True)
            break
    if not name:
        return None

    # E-Mail
    email = ""
    cf_span = soup.find("span", class_="__cf_email__")
    if cf_span and cf_span.get("data-cfemail"):
        email = decode_cf_email(cf_span["data-cfemail"])
    if not email:
        for a in soup.find_all("a", href=re.compile(r"^mailto:")):
            email = a["href"].replace("mailto:", "").strip()
            break

    # Telefon
    phone = ""
    for a in soup.find_all("a", href=re.compile(r"^tel:")):
        phone = a["href"].replace("tel:", "").strip()
        break
    if not phone:
        # Suche nach Telefonnummern im Text
        phone_match = re.search(r"(\+49[\s\-\d]{8,}|0[\d\s\-\/]{10,})", soup.get_text())
        if phone_match:
            phone = re.sub(r"\s+", " ", phone_match.group()).strip()[:20]

    # Website
    website = ""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if (href.startswith("http") and
            "allefotografen.de" not in href and
            "facebook" not in href and
            "instagram" not in href and
            "twitter" not in href and
            "youtube" not in href):
            website = href
            break

    # Beschreibung
    description = ""
    for selector in ["div.profile-description", "div.about", "div.bio", "div.entry-content", "section.description"]:
        el = soup.select_one(selector)
        if el:
            text = el.get_text(separator=" ", strip=True)
            if len(text) > 30:
                description = text[:400]
                break
    if not description:
        paragraphs = [p.get_text(strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 50]
        if paragraphs:
            description = paragraphs[0][:400]

    # Spezialisierungen
    specializations = []
    page_text = soup.get_text().lower()
    spec_keywords = ["hochzeit", "portrait", "business", "event", "newborn", "baby", "familie", "mode", "food", "architektur", "produkt", "sport"]
    for kw in spec_keywords:
        if kw in page_text:
            specializations.append(kw)

    # Stadt aus Profil (falls explizit angegeben)
    city_from_profile = ""
    for tag in soup.find_all(["span", "div", "p"], class_=re.compile(r"(city|location|ort|stadt)", re.I)):
        text = tag.get_text(strip=True)
        if text:
            city_from_profile = text[:100]
            break

    # Vollständigkeit prüfen
    contact_fields = sum(1 for x in [email, phone, website] if x)
    if contact_fields < MIN_COMPLETENESS:
        return None

    return {
        "name": name,
        "city_slug": city_slug,
        "city_from_profile": city_from_profile,
        "website_url": website,
        "contact_email": email,
        "contact_phone": phone,
        "description": description,
        "service_type": "photography",
        "specializations": specializations,
        "source_url": url,
    }


def scrape_all() -> list[dict]:
    all_profiles: list[dict] = []
    seen_urls: set[str] = set()

    for city_label, (city_url_slug, pd24_slug) in CITIES.items():
        print(f"\n=== {city_label} ===")
        profile_urls = get_profile_urls_for_city(city_label, city_url_slug)

        for url in profile_urls:
            if url in seen_urls:
                continue
            seen_urls.add(url)

            print(f"  Profil: {url}")
            profile = parse_profile(url, pd24_slug)
            if profile:
                all_profiles.append(profile)
                print(f"    OK {profile['name']} | {profile['contact_email'] or profile['contact_phone'] or profile['website_url'] or '(kein Kontakt)'}")
            else:
                print(f"    -- (uebersprungen)")
            time.sleep(1.0)

    return all_profiles


def to_sql_inserts(profiles: list[dict]) -> str:
    lines = [
        "-- Generiert von scrape_fotografen.py",
        "-- Importieren via Supabase SQL Editor",
        "",
        "INSERT INTO service_providers (id, slug, name, service_type, city_slug, description, website_url, contact_email, contact_phone, is_verified, status, meta)",
        "VALUES",
    ]

    rows = []
    for p in profiles:
        pid = str(uuid.uuid4())
        slug = to_slug(p["name"]) + "-fotograf"
        name = p["name"].replace("'", "''")
        desc = (p["description"] or "").replace("'", "''")
        website = (p["website_url"] or "").replace("'", "''")
        email = (p["contact_email"] or "").replace("'", "''")
        phone = (p["contact_phone"] or "").replace("'", "''")
        city = p["city_slug"]
        meta = json.dumps({
            "source": "allefotografen.de",
            "source_url": p["source_url"],
            "specializations": p["specializations"],
        }).replace("'", "''")

        rows.append(
            f"  ('{pid}', '{slug}', '{name}', 'photography', '{city}', '{desc}', "
            f"'{website}', '{email}', '{phone}', false, 'active', '{meta}'::jsonb)"
        )

    lines.append(",\n".join(rows) + ";")
    return "\n".join(lines)


def main():
    print("=== allefotografen.de Scraper ===\n")
    profiles = scrape_all()

    print(f"\n=== Ergebnis: {len(profiles)} Profile ===\n")

    json_path = os.path.join(OUTPUT_DIR, "fotografen.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(profiles, f, ensure_ascii=False, indent=2)
    print(f"JSON gespeichert: {json_path}")

    sql_path = os.path.join(OUTPUT_DIR, "fotografen.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(to_sql_inserts(profiles))
    print(f"SQL gespeichert:  {sql_path}")

    print("\n--- Übersicht ---")
    by_city: dict[str, int] = {}
    for p in profiles:
        by_city[p["city_slug"]] = by_city.get(p["city_slug"], 0) + 1
    for city, count in sorted(by_city.items()):
        print(f"  {city}: {count}")


if __name__ == "__main__":
    main()
