"""
apply-editorial-routes.py

Parses the 4 SQL migration files for editorial routes and applies them
via the Supabase REST + Auth Admin API (no direct DB connection needed).

Usage:
    python scripts/apply-editorial-routes.py
"""

import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import json
import os
import re
import time
import urllib.request
import urllib.error

# ── Env ──────────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, ".env.local")


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


env = load_env(ENV_FILE)
SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

EDITORIAL_USER_ID = "00000000-0000-0000-0000-000000000099"
EDITORIAL_EMAIL = "editorial@perfectday24.de"
EDITORIAL_USERNAME = "pd24-redaktion"

MIGRATION_FILES = [
    os.path.join(ROOT, "supabase/migrations/20260522160000_seed_editorial_routes_part1.sql"),
    os.path.join(ROOT, "supabase/migrations/20260522161000_seed_editorial_routes_part2.sql"),
    os.path.join(ROOT, "supabase/migrations/20260522162000_seed_editorial_routes_part3.sql"),
    os.path.join(ROOT, "supabase/migrations/20260522163000_seed_editorial_routes_part4.sql"),
]


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def api(method: str, path: str, body=None, extra_headers: dict | None = None, retries: int = 3) -> dict:
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra_headers:
        headers.update(extra_headers)
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            resp = urllib.request.urlopen(req, timeout=30)
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()
            raise RuntimeError(f"HTTP {e.code} {method} {path}: {body_txt[:300]}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Network error {method} {path}: {e}")


def auth_admin(method: str, path: str, body=None) -> dict:
    """Call Supabase Auth Admin API (v1 path)."""
    url = f"{SUPABASE_URL}/auth/v1{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode()
        raise RuntimeError(f"Auth HTTP {e.code} {method} {path}: {body_txt[:300]}")


# ── Setup editorial user ──────────────────────────────────────────────────────
def ensure_editorial_user() -> str:
    # Check if user already exists
    try:
        result = auth_admin("GET", f"/admin/users/{EDITORIAL_USER_ID}")
        if result.get("id"):
            print(f"  Editorial user already exists: {EDITORIAL_USER_ID}")
            return EDITORIAL_USER_ID
    except RuntimeError as e:
        if "404" not in str(e):
            raise

    # Search for existing user by email in the user list
    try:
        users = auth_admin("GET", "/admin/users?page=1&per_page=1000")
        for u in (users.get("users") or []):
            if u.get("email") == EDITORIAL_EMAIL:
                uid = u["id"]
                print(f"  Found editorial user by email: {uid}")
                return uid
    except Exception:
        pass

    # Create new user
    body = {
        "email": EDITORIAL_EMAIL,
        "password": "pd24-editorial-seed-password-not-for-login",
        "email_confirm": True,
        "user_metadata": {
            "username": EDITORIAL_USERNAME,
            "display_name": "PD24 Redaktion",
        },
    }
    try:
        result = auth_admin("POST", "/admin/users", body)
        uid = result.get("id", "")
        print(f"  Created editorial user: {uid}")
        return uid
    except RuntimeError as e:
        if "already registered" in str(e) or "email_exists" in str(e):
            # Try again to find by email
            users = auth_admin("GET", "/admin/users?page=1&per_page=1000")
            for u in (users.get("users") or []):
                if u.get("email") == EDITORIAL_EMAIL:
                    uid = u["id"]
                    print(f"  Found editorial user by email (retry): {uid}")
                    return uid
        raise


# ── Setup creator profile ─────────────────────────────────────────────────────
def ensure_creator_profile(user_id: str) -> str:
    result = api(
        "GET",
        f"/rest/v1/creator_profiles?user_id=eq.{user_id}&select=id",
        extra_headers={"Prefer": ""},
    )
    if isinstance(result, list) and result:
        cp_id = result[0]["id"]
        print(f"  Creator profile already exists: {cp_id}")
        return cp_id

    result = api(
        "POST",
        "/rest/v1/creator_profiles",
        {
            "user_id": user_id,
            "username": EDITORIAL_USERNAME,
            "display_name": "PD24 Redaktion",
            "bio": "Kuratierte Routen vom PerfectDay24-Redaktionsteam.",
            "is_verified": True,
            "creator_type": "editorial",
        },
    )
    cp_id = result[0]["id"] if isinstance(result, list) else result.get("id", "")
    print(f"  Created creator profile: {cp_id}")
    return cp_id


# ── SQL Parser ────────────────────────────────────────────────────────────────
def parse_migrations() -> list[dict]:
    """
    Parse all 4 migration SQL files and extract route + stop data.
    Returns a list of route dicts with embedded stops list.
    """
    routes: list[dict] = []

    # Regex patterns
    route_pat = re.compile(
        r"insert into public\.user_routes\s*\(.*?\)\s*values\s*\((.+?)\)\s*returning id into v_r",
        re.DOTALL | re.IGNORECASE,
    )
    stop_block_pat = re.compile(
        r"insert into public\.user_route_stops\s*\([^)]+\)\s*values\s*(.*?)(?=(?:insert|end\s*\$\$|--\s*={10,}))",
        re.DOTALL | re.IGNORECASE,
    )
    stop_row_pat = re.compile(
        r"\(v_r\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*(\d+)\s*,\s*(true|false)\s*\)"
    )

    for filepath in MIGRATION_FILES:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            sql = f.read()

        # Split by route inserts
        # Find all positions of route inserts
        route_positions = [(m.start(), m.end(), m) for m in route_pat.finditer(sql)]

        for i, (start, end, route_m) in enumerate(route_positions):
            values_str = route_m.group(1)

            # Parse the values – can be either:
            # Single-line: v_user_id,v_cp_id,'city','title','slug','desc','label',lat,lng,'vis','type','tags'
            # Multi-line:  v_user_id, v_cp_id, 'city',\n  'title', ...
            vals = parse_route_values(values_str)
            if not vals:
                continue

            city_slug = vals[2]
            title = vals[3]
            slug = vals[4]
            description = vals[5]
            start_label = vals[6]
            start_lat = float(vals[7])
            start_lng = float(vals[8])
            tags_raw = vals[11] if len(vals) > 11 else "[]"
            tags_clean = tags_raw.replace("::jsonb", "").strip().strip("'")
            try:
                tags = json.loads(tags_clean)
            except Exception:
                tags = []

            # Find stops that follow this route insert
            # Look in the text between this route and the next one (or end)
            if i + 1 < len(route_positions):
                next_start = route_positions[i + 1][0]
            else:
                next_start = len(sql)

            segment = sql[end:next_start]

            stops = []
            stop_block_m = re.search(
                r"insert into public\.user_route_stops\s*\([^)]+\)\s*values\s*(.*?)(?=;)",
                segment,
                re.DOTALL | re.IGNORECASE,
            )
            if stop_block_m:
                block = stop_block_m.group(1)
                for sm in stop_row_pat.finditer(block):
                    stops.append({
                        "stop_order": int(sm.group(1)),
                        "title": sm.group(2),
                        "note": sm.group(3),
                        "lat": float(sm.group(4)),
                        "lng": float(sm.group(5)),
                        "duration_min": int(sm.group(6)),
                        "is_required": sm.group(7) == "true",
                    })

            routes.append({
                "city_slug": city_slug,
                "title": title,
                "slug": slug,
                "description": description,
                "start_label": start_label,
                "start_lat": start_lat,
                "start_lng": start_lng,
                "tags": tags,
                "stops": stops,
            })

    return routes


def parse_route_values(values_str: str) -> list[str]:
    """
    Parse a PostgreSQL VALUES(...) string into a list of values.
    Handles multi-line, quoted strings with embedded content.
    """
    # Normalize whitespace
    s = re.sub(r"\s+", " ", values_str).strip()

    tokens: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "'":
            # Quoted string - find end, handling '' escapes
            j = i + 1
            while j < len(s):
                if s[j] == "'" and j + 1 < len(s) and s[j + 1] == "'":
                    j += 2  # skip escaped quote
                elif s[j] == "'":
                    break
                else:
                    j += 1
            tokens.append(s[i + 1 : j])
            i = j + 1
        elif s[i] == "[":
            # JSON array (tags)
            j = s.index("]", i)
            tokens.append(s[i : j + 1])
            i = j + 1
        elif s[i] in " ,\n\r":
            i += 1
        else:
            # Unquoted token (number, variable name)
            j = i
            while j < len(s) and s[j] not in " ,\n\r'[":
                j += 1
            token = s[i:j].strip()
            if token and token != "v_user_id" and token != "v_cp_id":
                tokens.append(token)
            elif token in ("v_user_id", "v_cp_id"):
                tokens.append(token)  # placeholder
            i = j

    return tokens


# ── Insert route + stops ──────────────────────────────────────────────────────
def insert_route(route: dict, user_id: str, cp_id: str) -> bool:
    """Returns True if inserted, False if already exists."""
    # Check if slug exists
    check = api(
        "GET",
        f"/rest/v1/user_routes?slug=eq.{route['slug']}&select=id",
        extra_headers={"Prefer": ""},
    )
    if isinstance(check, list) and check:
        return False  # already exists

    # Insert route
    route_body = {
        "user_id": user_id,
        "creator_profile_id": cp_id,
        "city_slug": route["city_slug"],
        "title": route["title"],
        "slug": route["slug"],
        "description": route["description"],
        "start_label": route["start_label"],
        "start_type": "address",
        "start_lat": route["start_lat"],
        "start_lng": route["start_lng"],
        "visibility": "public",
        "creator_type": "creator",   # 'editorial' blocked by live DB constraint
        "tags": route["tags"],
    }
    try:
        result = api("POST", "/rest/v1/user_routes", route_body)
    except RuntimeError as e:
        print(f"\n  ERROR inserting route {route['slug']}: {e}")
        return False

    route_id = (result[0]["id"] if isinstance(result, list) else result.get("id", ""))
    if not route_id:
        print(f"\n  ERROR: no ID returned for {route['slug']}")
        return False

    # Insert stops
    if route["stops"]:
        stop_rows = [
            {
                "route_id": route_id,
                "stop_order": s["stop_order"],
                "title": s["title"],
                "note": s["note"],
                "lat": s["lat"],
                "lng": s["lng"],
                "duration_min": s["duration_min"],
                "is_required": s["is_required"],
            }
            for s in route["stops"]
        ]
        try:
            api("POST", "/rest/v1/user_route_stops", stop_rows, extra_headers={"Prefer": "return=minimal"})
        except RuntimeError as e:
            print(f"\n  ERROR inserting stops for {route['slug']}: {e}")

    return True


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=== PD24 Editorial Routes Migration ===\n")
    print(f"Target: {SUPABASE_URL}\n")

    print("1. Parsing SQL migration files...")
    routes = parse_migrations()
    print(f"   Found {len(routes)} routes\n")

    print("2. Ensuring editorial user...")
    user_id = ensure_editorial_user()

    print("3. Ensuring creator profile...")
    cp_id = ensure_creator_profile(user_id)

    print(f"\n4. Inserting routes (+) / skipping existing (.):")
    inserted = 0
    skipped = 0

    for idx, route in enumerate(routes):
        if not route["city_slug"] or not route["slug"]:
            continue
        was_inserted = insert_route(route, user_id, cp_id)
        if was_inserted:
            inserted += 1
            sys.stdout.write("+")
        else:
            skipped += 1
            sys.stdout.write(".")
        sys.stdout.flush()
        if (idx + 1) % 40 == 0:
            print(f" [{idx+1}/{len(routes)}]")
        # Small delay to be gentle on the API
        time.sleep(0.05)

    print(f"\n\n=== Done! ===")
    print(f"  Inserted: {inserted}")
    print(f"  Skipped:  {skipped}")

    # Final count
    check = api(
        "GET",
        "/rest/v1/user_routes?creator_type=eq.editorial&select=count",
        extra_headers={"Prefer": "count=exact"},
    )
    print(f"  Editorial routes in DB: {len(check) if isinstance(check, list) else '?'}")


if __name__ == "__main__":
    main()
