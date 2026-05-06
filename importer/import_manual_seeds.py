import argparse
import csv
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()


def parse_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y"}


def parse_int(value: str | None):
    text = (value or "").strip()
    return int(text) if text else None


def parse_float(value: str | None):
    text = (value or "").strip()
    return float(text) if text else None


def parse_array(value: str | None) -> list[str]:
    text = (value or "").strip()
    if not text:
      return []

    if text.startswith("{") and text.endswith("}"):
        inner = text[1:-1].strip()
        if not inner:
            return []
        return [part.strip().strip('"') for part in inner.split(",") if part.strip()]

    return [part.strip() for part in text.split(",") if part.strip()]


def normalize_row(row: dict[str, str]):
    return {
        "city_slug": (row.get("city_slug") or "").strip(),
        "name": (row.get("name") or "").strip(),
        "category": (row.get("category") or "").strip(),
        "type": (row.get("type") or "").strip(),
        "subtypes": parse_array(row.get("subtypes")),
        "audiences": parse_array(row.get("audiences")),
        "occasions": parse_array(row.get("occasions")),
        "lat": parse_float(row.get("lat")),
        "lng": parse_float(row.get("lng")),
        "address": (row.get("address") or "").strip() or None,
        "website": (row.get("website") or "").strip() or None,
        "reservation_url": (row.get("reservation_url") or "").strip() or None,
        "price_level": parse_int(row.get("price_level")),
        "budget": (row.get("budget") or "").strip() or None,
        "indoor_outdoor": (row.get("indoor_outdoor") or "").strip() or None,
        "energy_level": (row.get("energy_level") or "").strip() or None,
        "family_friendly": parse_bool(row.get("family_friendly")),
        "nightlife_fit": parse_bool(row.get("nightlife_fit")),
        "duration_min": parse_int(row.get("duration_min")),
        "manual_boost": parse_float(row.get("manual_boost")) or 0,
        "data_confidence": parse_float(row.get("data_confidence")) or 0.95,
        "source_primary": (row.get("source_primary") or "manual_seed").strip(),
        "import_batch": (row.get("import_batch") or "").strip() or None,
        "notes": (row.get("notes") or "").strip() or None,
    }


UPSERT_SQL = """
insert into public.location_manual_seeds (
  city_slug,
  name,
  category,
  type,
  subtypes,
  audiences,
  occasions,
  lat,
  lng,
  address,
  website,
  reservation_url,
  price_level,
  budget,
  indoor_outdoor,
  energy_level,
  family_friendly,
  nightlife_fit,
  duration_min,
  manual_boost,
  data_confidence,
  source_primary,
  import_batch,
  notes,
  is_active,
  updated_at
)
values (
  %(city_slug)s,
  %(name)s,
  %(category)s,
  %(type)s,
  %(subtypes)s,
  %(audiences)s,
  %(occasions)s,
  %(lat)s,
  %(lng)s,
  %(address)s,
  %(website)s,
  %(reservation_url)s,
  %(price_level)s,
  %(budget)s,
  %(indoor_outdoor)s,
  %(energy_level)s,
  %(family_friendly)s,
  %(nightlife_fit)s,
  %(duration_min)s,
  %(manual_boost)s,
  %(data_confidence)s,
  %(source_primary)s,
  %(import_batch)s,
  %(notes)s,
  true,
  now()
)
on conflict (city_slug, name, type)
do update set
  category = excluded.category,
  subtypes = excluded.subtypes,
  audiences = excluded.audiences,
  occasions = excluded.occasions,
  lat = excluded.lat,
  lng = excluded.lng,
  address = excluded.address,
  website = excluded.website,
  reservation_url = excluded.reservation_url,
  price_level = excluded.price_level,
  budget = excluded.budget,
  indoor_outdoor = excluded.indoor_outdoor,
  energy_level = excluded.energy_level,
  family_friendly = excluded.family_friendly,
  nightlife_fit = excluded.nightlife_fit,
  duration_min = excluded.duration_min,
  manual_boost = excluded.manual_boost,
  data_confidence = excluded.data_confidence,
  source_primary = excluded.source_primary,
  import_batch = excluded.import_batch,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();
"""


def import_csv(csv_path: Path, database_url: str):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = [normalize_row(row) for row in reader]

    rows = [row for row in rows if row["city_slug"] and row["name"] and row["category"] and row["type"]]

    if not rows:
        print("No valid seed rows found.")
        return

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.executemany(UPSERT_SQL, rows)
        conn.commit()

    print(f"Imported {len(rows)} manual seed rows from {csv_path}")


def main():
    parser = argparse.ArgumentParser(description="Import manual seed CSV into public.location_manual_seeds")
    parser.add_argument(
        "--csv",
        default="data/location_manual_seeds_template.csv",
        help="Path to CSV file",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="Postgres connection string; defaults to DATABASE_URL env var",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise RuntimeError("DATABASE_URL missing. Pass --database-url or set DATABASE_URL in your environment.")

    import_csv(Path(args.csv), args.database_url)


if __name__ == "__main__":
    main()
