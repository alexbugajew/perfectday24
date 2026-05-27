"""
match-stop-locations.py

Matches editorial route stops to entries in the `locations` table by
proximity (GPS distance) + name similarity, then optionally writes:
  - location_id  (FK to locations)
  - external_url (from locations.reservation_url, if present)

Usage:
    python scripts/match-stop-locations.py           # dry-run, prints stats
    python scripts/match-stop-locations.py --apply   # writes to DB
    python scripts/match-stop-locations.py --city berlin-berlin  # single city
"""

import sys, io, json, math, re, time, difflib, argparse, os, urllib.request, urllib.error
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, ".env.local")

# ── Config ────────────────────────────────────────────────────────────────────
# Matching thresholds for location_id: (max_distance_m, min_name_similarity)
TIERS = [
    (80,  0.30),   # very close  + any name overlap
    (200, 0.50),   # close       + decent name match
    (400, 0.72),   # farther     + strong name match
]
# Minimum similarity to also write external_url (reservation link).
# Only assign the URL when we're confident it's the right venue.
URL_MIN_SIM = 0.50
URL_MAX_DIST = 250  # metres
# ─────────────────────────────────────────────────────────────────────────────

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


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def api_get(path: str, retries: int = 3) -> list | dict:
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Prefer": "",
    }
    for attempt in range(retries):
        req = urllib.request.Request(url, headers=headers)
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else []
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(f"GET {path}: {e}")
    return []


def api_patch(table: str, row_id: str, body: dict, retries: int = 3) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}"
    data = json.dumps(body).encode()
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
        try:
            urllib.request.urlopen(req, timeout=30)
            return
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()
            raise RuntimeError(f"PATCH {table}/{row_id}: HTTP {e.code} – {body_txt[:300]}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(f"PATCH {table}/{row_id}: {e}")


# ── Geo / name helpers ────────────────────────────────────────────────────────
def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def clean(name: str | None) -> str:
    if not name:
        return ""
    # strip parentheticals like "(Chipperfield)" or "(DDR-Fußgängerzone)"
    s = re.sub(r"\(.*?\)", "", name)
    # strip common suffixes that differ between stop titles and location names
    s = re.sub(r"\b(platz|straße|str\.?|gasse|allee|damm|weg|ring)\b", " ", s, flags=re.IGNORECASE)
    return s.strip().lower()


def name_sim(a: str, b: str) -> float:
    ca, cb = clean(a), clean(b)
    if not ca or not cb:
        return 0.0
    return difflib.SequenceMatcher(None, ca, cb).ratio()


def best_match(stop: dict, candidates: list[dict]) -> tuple[dict | None, float, float]:
    """Return (best_location, distance_m, similarity) or (None, inf, 0)."""
    slat, slng = stop.get("lat"), stop.get("lng")
    if slat is None or slng is None:
        return None, float("inf"), 0.0

    best_loc = None
    best_score = -1.0

    for loc in candidates:
        llat, llng = loc.get("lat"), loc.get("lng")
        if llat is None or llng is None:
            continue
        dist = haversine(slat, slng, llat, llng)

        # Quick reject: too far for any tier
        if dist > TIERS[-1][0]:
            continue

        sim = name_sim(stop.get("title", ""), loc.get("name", ""))

        # Check against tiers
        passes = any(dist <= max_d and sim >= min_s for max_d, min_s in TIERS)
        if not passes:
            continue

        # Combined score (weight proximity more)
        score = sim * 2 + max(0, 1 - dist / 400)
        if score > best_score:
            best_score = score
            best_loc = loc
            best_dist = dist
            best_sim = sim

    if best_loc is None:
        return None, float("inf"), 0.0
    return best_loc, best_dist, best_sim  # type: ignore[return-value]


# ── Data loaders ──────────────────────────────────────────────────────────────
def load_locations_for_city(city_slug: str) -> list[dict]:
    """Paginate through all locations for a city."""
    all_locs: list[dict] = []
    limit = 1000
    offset = 0
    while True:
        batch = api_get(
            f"/rest/v1/locations"
            f"?city_slug=eq.{city_slug}"
            f"&select=id,name,lat,lng,reservation_url"
            f"&limit={limit}&offset={offset}"
        )
        if not isinstance(batch, list):
            break
        all_locs.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return all_locs


def load_editorial_stops_by_city() -> dict[str, list[dict]]:
    """Return {city_slug: [stop, ...]} with stop enriched with route.city_slug."""
    # Load all editorial routes
    routes = api_get(
        "/rest/v1/user_routes"
        "?creator_type=eq.editorial"
        "&select=id,city_slug"
        "&limit=300"
    )
    if not isinstance(routes, list):
        return {}

    route_city: dict[str, str] = {r["id"]: r["city_slug"] for r in routes if r.get("city_slug")}
    all_route_ids = list(route_city.keys())

    # Load all stops in batches (URL length limit)
    all_stops: list[dict] = []
    batch_size = 50
    for i in range(0, len(all_route_ids), batch_size):
        batch_ids = all_route_ids[i : i + batch_size]
        in_clause = ",".join(batch_ids)
        batch = api_get(
            f"/rest/v1/user_route_stops"
            f"?route_id=in.({in_clause})"
            f"&select=id,route_id,title,lat,lng,location_id,external_url"
            f"&limit=2000"
        )
        if isinstance(batch, list):
            all_stops.extend(batch)

    # Group by city
    by_city: dict[str, list[dict]] = {}
    for stop in all_stops:
        city = route_city.get(stop.get("route_id", ""))
        if not city:
            continue
        stop["city_slug"] = city
        by_city.setdefault(city, []).append(stop)

    return by_city


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Match editorial stops to locations")
    parser.add_argument("--apply", action="store_true", help="Write matches to DB (default: dry-run)")
    parser.add_argument("--city", default=None, help="Limit to one city_slug")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== Editorial Stop → Location Matching  [{mode}] ===\n")

    print("Loading editorial stops …")
    by_city = load_editorial_stops_by_city()
    cities_to_process = sorted(by_city.keys())
    if args.city:
        if args.city not in by_city:
            print(f"City '{args.city}' not found in editorial stops. Available: {', '.join(cities_to_process)}")
            sys.exit(1)
        cities_to_process = [args.city]

    total_stops = sum(len(v) for v in by_city.values())
    print(f"  {total_stops} stops across {len(by_city)} cities\n")

    # Aggregated stats
    total_matched = 0
    total_with_url = 0
    total_skipped_existing = 0
    total_unmatched = 0
    updates: list[tuple[str, dict]] = []  # (stop_id, patch_body)

    for city_slug in cities_to_process:
        stops = by_city[city_slug]
        print(f"  [{city_slug}]  {len(stops)} stops — loading locations …", end=" ", flush=True)
        locs = load_locations_for_city(city_slug)
        print(f"{len(locs)} locations found")

        city_matched = 0
        city_with_url = 0

        for stop in stops:
            # Skip stops that already have location_id set
            if stop.get("location_id"):
                total_skipped_existing += 1
                continue

            loc, dist, sim = best_match(stop, locs)

            if loc is None:
                total_unmatched += 1
                continue

            city_matched += 1
            total_matched += 1
            res_url = loc.get("reservation_url") or ""

            patch: dict = {"location_id": loc["id"]}
            url_confident = res_url and sim >= URL_MIN_SIM and dist <= URL_MAX_DIST
            if url_confident and not stop.get("external_url"):
                patch["external_url"] = res_url
                city_with_url += 1
                total_with_url += 1

            updates.append((stop["id"], patch))

            # Verbose output
            url_tag = f"  → {res_url[:60]}" if res_url else ""
            print(
                f"    ✓ [{int(dist):3}m sim={sim:.2f}]  "
                f"{(stop['title'] or '')[:35]:35} → {loc['name'][:35]}{url_tag}"
            )

        print(f"    → matched {city_matched}, with URL: {city_with_url}\n")

    # Summary
    print("─" * 60)
    print(f"Total stops processed : {total_stops}")
    print(f"  Already linked       : {total_skipped_existing}")
    print(f"  Matched              : {total_matched}  ({total_with_url} with reservation_url)")
    print(f"  Unmatched            : {total_unmatched}")
    print()

    if not updates:
        print("Nothing to update.")
        return

    if not args.apply:
        print(f"Dry-run complete. Run with --apply to write {len(updates)} updates to the DB.")
        return

    # Apply updates
    print(f"Writing {len(updates)} updates …")
    ok = 0
    failed = 0
    for idx, (stop_id, patch) in enumerate(updates):
        try:
            api_patch("user_route_stops", stop_id, patch)
            ok += 1
        except RuntimeError as e:
            print(f"  ERROR stop {stop_id}: {e}")
            failed += 1
        sys.stdout.write("." if ok % 10 != 0 else f" [{ok}]\n")
        sys.stdout.flush()
        time.sleep(0.03)

    print(f"\n\nDone! Wrote {ok} updates, {failed} errors.")


if __name__ == "__main__":
    main()
