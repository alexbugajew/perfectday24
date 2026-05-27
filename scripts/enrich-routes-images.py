"""
enrich-routes-images.py

Fetches free images from Wikimedia Commons (via Wikipedia REST API) for
editorial routes that have no cover_image_url, then writes:
  - cover_image_url  (1280px Wikimedia thumbnail)
  - meta.image_attribution  (author, license, landing_url, license_url)

Search strategy per route:
  1. German Wikipedia article for the first stop's title
  2. German Wikipedia article for the city name
  3. English Wikipedia article for the first stop's title
  4. English Wikipedia article for the city name

Usage:
    python scripts/enrich-routes-images.py           # dry-run
    python scripts/enrich-routes-images.py --apply   # writes to DB
    python scripts/enrich-routes-images.py --city berlin-berlin  # one city
    python scripts/enrich-routes-images.py --force   # overwrite existing images
"""

import sys, io, json, re, time, argparse, os, urllib.request, urllib.error, urllib.parse
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, ".env.local")

# ── City name mapping (slug → German Wikipedia article title) ─────────────────
CITY_WIKI: dict[str, str] = {
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
    "essen":                "Essen (Ruhr)",
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
}


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


env = load_env(ENV_FILE)
SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS_SB = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Prefer": "",
}
HEADERS_WP = {"User-Agent": "PD24ImageBot/1.0 (contact@perfectday24.de)"}


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def get_json(url: str, extra_headers: dict | None = None, timeout: int = 15) -> dict | list | None:
    headers = {**HEADERS_WP}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else None
    except Exception:
        return None


def sb_get(path: str) -> list | dict:
    url = f"{SUPABASE_URL}{path}"
    req = urllib.request.Request(url, headers=HEADERS_SB)
    resp = urllib.request.urlopen(req, timeout=30)
    raw = resp.read().decode()
    return json.loads(raw) if raw.strip() else []


def sb_patch(table: str, row_id: str, body: dict, retries: int = 3) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}"
    data = json.dumps(body).encode()
    headers = {**HEADERS_SB, "Content-Type": "application/json", "Prefer": "return=minimal"}
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
        try:
            urllib.request.urlopen(req, timeout=30)
            return
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()
            raise RuntimeError(f"HTTP {e.code}: {body_txt[:300]}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(str(e))


# ── Wikipedia image lookup ────────────────────────────────────────────────────
def _clean_stop_title(title: str) -> str:
    """Strip parentheticals and extra context from stop title."""
    s = re.sub(r"\s*\(.*?\)", "", title)
    # Remove descriptive suffixes after em-dash or &
    s = re.sub(r"\s*[&–]\s*.*$", "", s)
    return s.strip()


def _thumb_1280(url: str) -> str | None:
    """Convert any Wikimedia image URL to a 1280px thumbnail."""
    if not url:
        return None
    # Already a thumbnail: replace the size
    m = re.search(r"(https://upload\.wikimedia\.org/wikipedia/(?:commons|en|de)/thumb/.+/)(\d+)px-(.+)$", url)
    if m:
        return f"{m.group(1)}1280px-{m.group(3)}"
    # Original file: build thumb URL
    m2 = re.search(r"(https://upload\.wikimedia\.org/wikipedia/(?:commons|en|de)/)([^/]+/[^/]+/)(.+)$", url)
    if m2:
        return f"{m2.group(1)}thumb/{m2.group(2)}{m2.group(3)}/1280px-{m2.group(3)}"
    return url


def _clean_html(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s).strip()


def _commons_attribution(image_url: str) -> dict | None:
    """Query Wikimedia Commons extmetadata for a given image URL."""
    # Extract filename from URL
    fname_raw = image_url.rstrip("/").split("/")[-1]
    # Remove size prefix if present (e.g. "1280px-" or "3840px-")
    fname_raw = re.sub(r"^\d+px-", "", fname_raw)
    fname = urllib.parse.unquote(fname_raw)
    enc = urllib.parse.quote(fname)
    url = (
        f"https://commons.wikimedia.org/w/api.php?action=query"
        f"&titles=File:{enc}&prop=imageinfo"
        f"&iiprop=url|user|extmetadata&format=json"
    )
    data = get_json(url)
    if not data:
        return None
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        ii = (page.get("imageinfo") or [{}])[0]
        em = ii.get("extmetadata") or {}
        creator_raw = _clean_html(em.get("Artist", {}).get("value", "") or "")
        license_name = em.get("LicenseShortName", {}).get("value", "") or ""
        license_url = em.get("LicenseUrl", {}).get("value", "") or ""
        return {
            "title": fname,
            "creator": creator_raw,
            "license": license_name,
            "license_url": license_url,
            "landing_url": f"https://commons.wikimedia.org/wiki/File:{enc}",
            "provider_source": "Wikimedia Commons",
        }
    return None


def wikipedia_image(article_title: str, lang: str = "de") -> tuple[str, dict] | tuple[None, None]:
    """
    Fetch cover image for an article from Wikipedia.
    Returns (image_url_1280, attribution_dict) or (None, None).
    """
    enc = urllib.parse.quote(article_title.replace(" ", "_"))
    summary = get_json(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{enc}")
    if not summary:
        return None, None

    # Prefer originalimage, fall back to thumbnail
    img_info = summary.get("originalimage") or summary.get("thumbnail")
    if not img_info:
        return None, None

    raw_url = img_info.get("source", "")
    if not raw_url or "upload.wikimedia.org" not in raw_url:
        return None, None

    # Skip SVG, GIF (animated), and icons that are too small
    lower = raw_url.lower()
    if any(ext in lower for ext in (".svg", ".gif")):
        return None, None
    w = img_info.get("width", 0)
    h = img_info.get("height", 0)
    if w > 0 and h > 0 and w < h:   # portrait → skip for cover
        return None, None
    if w > 0 and w < 300:
        return None, None

    thumb_url = _thumb_1280(raw_url)
    if not thumb_url:
        return None, None

    attribution = _commons_attribution(raw_url)
    if not attribution:
        attribution = {"provider_source": "Wikimedia Commons / Wikipedia"}

    return thumb_url, attribution


def find_image_for_route(
    first_stop_title: str | None,
    city_slug: str,
) -> tuple[str, dict] | tuple[None, None]:
    """
    Try multiple search strategies and return (url, attribution) for the best image.
    """
    candidates: list[tuple[str, str]] = []

    if first_stop_title:
        clean = _clean_stop_title(first_stop_title)
        if clean:
            candidates.append((clean, "de"))
            candidates.append((clean, "en"))

    city_name = CITY_WIKI.get(city_slug)
    if city_name:
        candidates.append((city_name, "de"))
        candidates.append((city_name, "en"))

    for title, lang in candidates:
        url, attr = wikipedia_image(title, lang)
        if url:
            return url, attr
        time.sleep(0.1)  # be polite

    return None, None


# ── Data loaders ──────────────────────────────────────────────────────────────
def load_editorial_routes(city_filter: str | None, force: bool) -> list[dict]:
    path = "/rest/v1/user_routes?creator_type=eq.editorial&select=id,title,slug,city_slug,cover_image_url,meta&limit=300"
    routes = sb_get(path)
    if not isinstance(routes, list):
        return []
    if city_filter:
        routes = [r for r in routes if r.get("city_slug") == city_filter]
    if not force:
        routes = [r for r in routes if not r.get("cover_image_url")]
    return routes


def load_first_stops(route_ids: list[str]) -> dict[str, str]:
    """Return {route_id: first_stop_title}."""
    result: dict[str, str] = {}
    batch_size = 50
    for i in range(0, len(route_ids), batch_size):
        batch = route_ids[i : i + batch_size]
        in_clause = ",".join(batch)
        stops = sb_get(
            f"/rest/v1/user_route_stops?route_id=in.({in_clause})"
            f"&select=route_id,stop_order,title"
            f"&order=route_id,stop_order"
            f"&limit=1000"
        )
        if not isinstance(stops, list):
            continue
        for stop in stops:
            rid = stop.get("route_id", "")
            if rid and rid not in result and stop.get("title"):
                result[rid] = stop["title"]
    return result


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich editorial routes with free Wikimedia images")
    parser.add_argument("--apply", action="store_true", help="Write to DB (default: dry-run)")
    parser.add_argument("--city",  default=None,        help="Limit to one city_slug")
    parser.add_argument("--force", action="store_true", help="Overwrite existing cover_image_url")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== Editorial Route Image Enrichment  [{mode}] ===\n")

    print("Loading routes …")
    routes = load_editorial_routes(args.city, args.force)
    print(f"  {len(routes)} routes need images\n")

    if not routes:
        print("Nothing to do.")
        return

    print("Loading first stops …")
    first_stop = load_first_stops([r["id"] for r in routes])

    found = 0
    not_found = 0
    updates: list[tuple[str, dict]] = []

    print("\nSearching images …\n")
    for route in routes:
        slug = route.get("slug", "")
        city_slug = route.get("city_slug", "")
        stop_title = first_stop.get(route["id"])

        img_url, attr = find_image_for_route(stop_title, city_slug)

        if not img_url:
            not_found += 1
            print(f"  ✗ {slug[:55]}")
            continue

        found += 1
        fname = img_url.rstrip("/").split("/")[-1]
        creator = (attr or {}).get("creator", "")[:40]
        license_ = (attr or {}).get("license", "")
        print(f"  ✓ {slug[:50]:52} [{license_}] {creator}")
        print(f"    {img_url[:90]}")

        # Merge image_attribution into existing meta
        existing_meta: dict = {}
        if isinstance(route.get("meta"), dict):
            existing_meta = dict(route["meta"])
        existing_meta["image_attribution"] = attr or {"provider_source": "Wikimedia Commons"}

        updates.append((route["id"], {
            "cover_image_url": img_url,
            "meta": existing_meta,
        }))

        time.sleep(0.15)  # rate-limit Wikipedia requests

    print(f"\n{'─'*60}")
    print(f"Found images: {found}  |  Not found: {not_found}")

    if not updates:
        print("Nothing to update.")
        return

    if not args.apply:
        print(f"\nDry-run done. Run with --apply to write {len(updates)} route images to DB.")
        return

    print(f"\nWriting {len(updates)} updates …")
    ok = 0
    errors = 0
    for route_id, patch in updates:
        try:
            sb_patch("user_routes", route_id, patch)
            ok += 1
        except RuntimeError as e:
            print(f"  ERROR {route_id}: {e}")
            errors += 1
        sys.stdout.write("." if ok % 10 != 0 else f" [{ok}]\n")
        sys.stdout.flush()
        time.sleep(0.05)

    print(f"\n\nDone! Wrote {ok} route images, {errors} errors.")


if __name__ == "__main__":
    main()
