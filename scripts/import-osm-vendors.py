"""
import-osm-vendors.py

Fetches event-relevant businesses from OpenStreetMap (Overpass API) for all
33 German cities and seeds them into the service_providers table.

OSM categories imported → service_type mapping:
  shop=florist          → florist
  amenity=events_venue  → location
  amenity=conference_centre → location
  craft=photographer    → photography
  shop=party            → decoration

Deduplication: skips rows that already have meta.osm_id matching an existing
service_providers entry, so re-running is safe.
Attribution stored in meta: source="osm", osm_id, osm_type, osm_tags.

Usage:
    python scripts/import-osm-vendors.py              # dry-run (no DB writes)
    python scripts/import-osm-vendors.py --apply      # write to DB
    python scripts/import-osm-vendors.py --city koeln # one city only
    python scripts/import-osm-vendors.py --type florist  # one category only
"""

import sys, io, json, re, time, argparse, os, urllib.request, urllib.error, urllib.parse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, ".env.local")

# ── City slug → OSM area name ──────────────────────────────────────────────────
CITY_OSM: dict[str, str] = {
    "berlin-berlin":        "Berlin",
    "hamburg-hamburg":      "Hamburg",
    "muenchen":             "München",
    "koeln":                "Köln",
    "frankfurt-am-main":    "Frankfurt am Main",
    "stuttgart":            "Stuttgart",
    "duesseldorf":          "Düsseldorf",
    "leipzig":              "Leipzig",
    "dresden":              "Dresden",
    "hannover":             "Hannover",
    "nuernberg":            "Nürnberg",
    "bremen":               "Bremen",
    "dortmund":             "Dortmund",
    "essen":                "Essen",
    "bonn":                 "Bonn",
    "muenster":             "Münster",
    "mannheim":             "Mannheim",
    "wiesbaden":            "Wiesbaden",
    "aachen":               "Aachen",
    "karlsruhe":            "Karlsruhe",
    "duisburg":             "Duisburg",
    "bochum":               "Bochum",
    "wuppertal":            "Wuppertal",
    "bielefeld":            "Bielefeld",
    "augsburg":             "Augsburg",
    "braunschweig":         "Braunschweig",
    "kiel":                 "Kiel",
    "gelsenkirchen":        "Gelsenkirchen",
    "moenchengladbach":     "Mönchengladbach",
    "magdeburg":            "Magdeburg",
    "freiburg-im-breisgau": "Freiburg im Breisgau",
    "luebeck":              "Lübeck",
    "erfurt":               "Erfurt",
    # Wave 4 — 45 weitere deutsche Großstädte (≥100k Einwohner)
    "chemnitz":             "Chemnitz",
    "krefeld":              "Krefeld",
    "halle":                "Halle (Saale)",
    "mainz":                "Mainz",
    "oberhausen":           "Oberhausen",
    "rostock":              "Rostock",
    "kassel":               "Kassel",
    "hagen":                "Hagen",
    "potsdam":              "Potsdam",
    "saarbruecken":         "Saarbrücken",
    "hamm":                 "Hamm",
    "ludwigshafen-am-rhein":"Ludwigshafen am Rhein",
    "oldenburg":            "Oldenburg",
    "muelheim-an-der-ruhr": "Mülheim an der Ruhr",
    "leverkusen":           "Leverkusen",
    "darmstadt":            "Darmstadt",
    "osnabrueck":           "Osnabrück",
    "solingen":             "Solingen",
    "herne":                "Herne",
    "paderborn":            "Paderborn",
    "heidelberg":           "Heidelberg",
    "neuss":                "Neuss",
    "regensburg":           "Regensburg",
    "ingolstadt":           "Ingolstadt",
    "pforzheim":            "Pforzheim",
    "wuerzburg":            "Würzburg",
    "offenbach-am-main":    "Offenbach am Main",
    "heilbronn":            "Heilbronn",
    "fuerth":               "Fürth",
    "goettingen":           "Göttingen",
    "ulm":                  "Ulm",
    "wolfsburg":            "Wolfsburg",
    "reutlingen":           "Reutlingen",
    "bremerhaven":          "Bremerhaven",
    "bottrop":              "Bottrop",
    "erlangen":             "Erlangen",
    "recklinghausen":       "Recklinghausen",
    "koblenz":              "Koblenz",
    "remscheid":            "Remscheid",
    "bergisch-gladbach":    "Bergisch Gladbach",
    "jena":                 "Jena",
    "salzgitter":           "Salzgitter",
    "trier":                "Trier",
    "siegen":               "Siegen",
    "moers":                "Moers",
}

# ── OSM filter → service_type ──────────────────────────────────────────────────
# Each entry: (overpass_filter_string, service_type, category_label)
OSM_CATEGORIES: list[tuple[str, str, str]] = [
    ('[\"shop\"=\"florist\"]',              "florist",     "Floristen"),
    ('[\"amenity\"=\"events_venue\"]',      "location",    "Event-Venues"),
    ('[\"amenity\"=\"conference_centre\"]', "location",    "Konferenzzentren"),
    ('[\"craft\"=\"photographer\"]',        "photography", "Fotografen"),
    ('[\"shop\"=\"party\"]',               "decoration",  "Party-/Deko-Shops"),
    ('[\"shop\"=\"confectionery\"]',        "cake",        "Konditoreien"),
    ('[\"craft\"=\"confectionery\"]',       "cake",        "Konditor (Handwerk)"),
    ('[\"shop\"=\"pastry\"]',              "cake",        "Patisserie / Feingebäck"),
    ('[\"craft\"=\"caterer\"]',            "catering",    "Catering-Unternehmen"),
]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS_OVP  = {"User-Agent": "PD24OSMBot/1.0 (contact@perfectday24.de)"}


# ── Config loading ─────────────────────────────────────────────────────────────
def load_env(path: str) -> dict:
    env: dict = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


env          = load_env(ENV_FILE)
SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SERVICE_KEY  = env["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS_SB   = {
    "apikey":        SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Prefer":        "",
}


# ── HTTP helpers ───────────────────────────────────────────────────────────────
def overpass_query(query: str, retries: int = 3) -> list[dict]:
    """Run an Overpass QL query and return the elements list."""
    url  = OVERPASS_URL
    data = ("data=" + urllib.parse.quote(query)).encode()
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=HEADERS_OVP, method="POST")
        try:
            resp = urllib.request.urlopen(req, timeout=90)
            result = json.loads(resp.read())
            return result.get("elements", [])
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:200]
            if e.code == 429 or "Too Many Requests" in body:
                wait = 30 * (attempt + 1)
                print(f"    [rate limit] sleeping {wait}s …")
                time.sleep(wait)
            elif attempt < retries - 1:
                time.sleep(5)
            else:
                raise RuntimeError(f"Overpass HTTP {e.code}: {body}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
            else:
                raise RuntimeError(str(e))
    return []


def sb_get(path: str) -> list | dict:
    url  = f"{SUPABASE_URL}{path}"
    req  = urllib.request.Request(url, headers=HEADERS_SB)
    resp = urllib.request.urlopen(req, timeout=30)
    raw  = resp.read().decode()
    return json.loads(raw) if raw.strip() else []


def sb_post_batch(rows: list[dict], retries: int = 3) -> None:
    """Bulk-insert rows into service_providers."""
    url     = f"{SUPABASE_URL}/rest/v1/service_providers"
    payload = json.dumps(rows).encode()
    headers = {
        **HEADERS_SB,
        "Content-Type": "application/json",
        "Prefer":       "return=minimal,resolution=ignore-duplicates",
    }
    for attempt in range(retries):
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            urllib.request.urlopen(req, timeout=60)
            return
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(f"HTTP {e.code}: {body[:300]}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(str(e))


# ── Tag helpers ────────────────────────────────────────────────────────────────
def tag(el: dict, *keys: str, default: str = "") -> str:
    tags = el.get("tags", {})
    for k in keys:
        v = tags.get(k, "")
        if v:
            return v.strip()
    return default


def coords(el: dict) -> tuple[float | None, float | None]:
    if el.get("type") == "node":
        return el.get("lat"), el.get("lon")
    center = el.get("center") or {}
    return center.get("lat"), center.get("lon")


def build_address(el: dict) -> str:
    tags = el.get("tags", {})
    parts: list[str] = []
    street = tags.get("addr:street", "")
    hn     = tags.get("addr:housenumber", "")
    if street and hn:
        parts.append(f"{street} {hn}")
    elif street:
        parts.append(street)
    plz    = tags.get("addr:postcode", "")
    city   = tags.get("addr:city", "")
    if plz and city:
        parts.append(f"{plz} {city}")
    elif city:
        parts.append(city)
    return ", ".join(parts)


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = s.encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:60]


# ── Overpass query builder ─────────────────────────────────────────────────────
def build_query(osm_city_name: str, tag_filters: list[str]) -> str:
    """Build a combined Overpass query for a city and multiple tag filters."""
    area_selector = (
        f'area["name"="{osm_city_name}"]["boundary"="administrative"]'
        '["admin_level"~"4|6|8"]->.a'
    )
    node_ways = []
    for f in tag_filters:
        node_ways.append(f"node{f}(area.a);")
        node_ways.append(f"way{f}(area.a);")
    inner = "\n  ".join(node_ways)
    return f"[out:json][timeout:90];\n{area_selector};\n(\n  {inner}\n);\nout center tags;"


# ── Deduplication ──────────────────────────────────────────────────────────────
def load_existing_osm_ids() -> set[str]:
    """Return set of osm_ids already in service_providers."""
    existing: set[str] = set()
    limit   = 1000
    offset  = 0
    while True:
        batch = sb_get(
            f"/rest/v1/service_providers"
            f"?select=meta"
            f"&not.meta->>source.is.null"
            f"&limit={limit}&offset={offset}"
        )
        if not isinstance(batch, list):
            break
        for row in batch:
            m = row.get("meta") or {}
            oid = m.get("osm_id")
            if oid:
                existing.add(str(oid))
        if len(batch) < limit:
            break
        offset += limit
    return existing


# ── Main ───────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Import OSM event vendors into service_providers")
    parser.add_argument("--apply", action="store_true", help="Write to DB (default: dry-run)")
    parser.add_argument("--city",  default=None, help="Limit to one city_slug")
    parser.add_argument("--type",  default=None, help="Limit to one service_type (florist|location|photography|decoration)")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== OSM Event Vendor Import  [{mode}] ===\n")

    cities_to_run = list(CITY_OSM.items())
    if args.city:
        if args.city not in CITY_OSM:
            print(f"Unknown city slug: {args.city}")
            print(f"Available: {', '.join(CITY_OSM)}")
            sys.exit(1)
        cities_to_run = [(args.city, CITY_OSM[args.city])]

    categories_to_run = OSM_CATEGORIES
    if args.type:
        categories_to_run = [(f, t, l) for f, t, l in OSM_CATEGORIES if t == args.type]
        if not categories_to_run:
            print(f"Unknown type: {args.type}")
            sys.exit(1)

    print("Loading existing OSM IDs for deduplication …")
    existing_osm_ids = load_existing_osm_ids()
    print(f"  {len(existing_osm_ids)} existing OSM entries found\n")

    total_new     = 0
    total_skipped = 0
    total_errors  = 0
    all_rows: list[dict] = []

    for city_slug, osm_city in cities_to_run:
        tag_filters  = [f for f, _, _ in categories_to_run]
        type_by_filt = {f: t for f, t, _ in categories_to_run}

        print(f"[{city_slug}]  querying {len(tag_filters)} categories …", end=" ", flush=True)

        try:
            query    = build_query(osm_city, tag_filters)
            elements = overpass_query(query)
        except RuntimeError as e:
            print(f"OVERPASS ERROR: {e}")
            total_errors += 1
            time.sleep(3)
            continue

        print(f"{len(elements)} elements")

        city_new = 0

        for el in elements:
            osm_id   = str(el.get("id", ""))
            osm_type = el.get("type", "node")
            tags     = el.get("tags", {})

            if not osm_id:
                continue

            # Determine service_type from OSM tags
            stype = None
            t_shop    = tags.get("shop", "")
            t_amenity = tags.get("amenity", "")
            t_craft   = tags.get("craft", "")

            if t_shop == "florist":
                stype = "florist"
            elif t_amenity in ("events_venue", "conference_centre"):
                stype = "location"
            elif t_craft == "photographer":
                stype = "photography"
            elif t_shop == "party":
                stype = "decoration"
            elif t_shop in ("confectionery", "pastry") or t_craft == "confectionery":
                stype = "cake"
            elif t_craft == "caterer":
                stype = "catering"

            if not stype:
                total_skipped += 1
                continue

            name = tag(el, "name")
            if not name:
                total_skipped += 1
                continue

            # Skip if already imported
            if osm_id in existing_osm_ids:
                total_skipped += 1
                continue

            lat, lon = coords(el)
            address  = build_address(el)

            website = tag(el, "website", "contact:website", "url")
            email   = tag(el, "email", "contact:email")
            phone   = tag(el, "phone", "contact:phone", "fax")

            # Build a short description from address + OSM description
            desc_parts = []
            osm_desc = tag(el, "description")
            if osm_desc:
                desc_parts.append(osm_desc[:120])
            if address:
                desc_parts.append(address)
            description = " · ".join(desc_parts) if desc_parts else None

            slug = f"{city_slug}-{osm_type[0]}{osm_id}"

            row: dict = {
                "slug":         slug,
                "name":         name,
                "service_type": stype,
                "city_slug":    city_slug,
                "city_slugs":   [city_slug],
                "description":  description,
                "website_url":  website or None,
                "contact_email": email or None,
                "contact_phone": phone or None,
                "is_verified":  False,
                "status":       "active",
                "meta": {
                    "source":   "osm",
                    "osm_id":   int(osm_id),
                    "osm_type": osm_type,
                    "lat":      lat,
                    "lng":      lon,
                },
            }

            all_rows.append(row)
            existing_osm_ids.add(osm_id)  # prevent within-run dupes
            city_new += 1
            total_new += 1

        print(f"    → {city_new} new, {len(elements) - city_new} skipped/existing")

        # Polite delay between cities
        time.sleep(2)

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"New entries found  : {total_new}")
    print(f"Skipped (dup/noname): {total_skipped}")
    print(f"City errors        : {total_errors}")
    print()

    if not all_rows:
        print("Nothing to insert.")
        return

    # Service type breakdown
    from collections import Counter
    breakdown = Counter(r["service_type"] for r in all_rows)
    print("Breakdown by service_type:")
    for st, cnt in sorted(breakdown.items(), key=lambda x: -x[1]):
        print(f"  {st:20}  {cnt}")
    print()

    if not args.apply:
        print(f"Dry-run complete — run with --apply to insert {len(all_rows)} rows into service_providers.")
        return

    # ── Write to DB in batches ─────────────────────────────────────────────────
    print(f"Writing {len(all_rows)} rows in batches …")
    batch_size = 100
    ok = 0
    errors = 0
    for i in range(0, len(all_rows), batch_size):
        batch = all_rows[i : i + batch_size]
        try:
            sb_post_batch(batch)
            ok += len(batch)
        except RuntimeError as e:
            print(f"\n  ERROR batch {i//batch_size}: {e}")
            errors += len(batch)
        sys.stdout.write("." if (i // batch_size) % 10 != 9 else f" [{ok}]\n")
        sys.stdout.flush()
        time.sleep(0.1)

    print(f"\n\nDone! Inserted {ok} rows, {errors} errors.")


if __name__ == "__main__":
    main()
