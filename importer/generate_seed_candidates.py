import argparse
import csv
import os
from collections import defaultdict
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()


TARGET_SUBTYPES: dict[str, dict[str, object]] = {
    "zoo": {
        "patterns": ["zoo", "tierpark", "wildpark", "animal park"],
        "types": {"zoo", "attraction", "park"},
        "category": "activity",
        "audiences": ["family", "tourism"],
        "occasions": ["family", "tourism"],
        "indoor_outdoor": "outdoor",
        "energy_level": "medium",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 150,
        "manual_boost": 14,
    },
    "aquarium": {
        "patterns": ["aquarium", "sea life", "sealife", "ocean"],
        "types": {"aquarium", "museum", "attraction"},
        "category": "activity",
        "audiences": ["family", "tourism"],
        "occasions": ["family", "tourism"],
        "indoor_outdoor": "indoor",
        "energy_level": "low",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 120,
        "manual_boost": 13,
    },
    "playground": {
        "patterns": ["spielplatz", "playground", "abenteuerspielplatz"],
        "types": {"playground", "park", "attraction"},
        "category": "activity",
        "audiences": ["family"],
        "occasions": ["family"],
        "indoor_outdoor": "outdoor",
        "energy_level": "medium",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 45,
        "manual_boost": 9,
    },
    "children_museum": {
        "patterns": ["kindermuseum", "children museum", "museum", "machmit"],
        "types": {"museum", "attraction"},
        "category": "culture",
        "audiences": ["family", "tourism"],
        "occasions": ["family", "tourism"],
        "indoor_outdoor": "indoor",
        "energy_level": "low",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 90,
        "manual_boost": 11,
    },
    "science_center": {
        "patterns": ["science", "technikmuseum", "planetarium", "experimenta"],
        "types": {"museum", "planetarium", "attraction"},
        "category": "culture",
        "audiences": ["family", "tourism"],
        "occasions": ["family", "tourism"],
        "indoor_outdoor": "indoor",
        "energy_level": "low",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 120,
        "manual_boost": 11,
    },
    "viewpoint": {
        "patterns": ["viewpoint", "aussicht", "panorama", "tower", "plattform", "lookout"],
        "types": {"viewpoint", "attraction", "tower", "place_of_worship"},
        "category": "culture",
        "audiences": ["date", "tourism"],
        "occasions": ["date", "tourism"],
        "indoor_outdoor": "outdoor",
        "energy_level": "low",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 45,
        "manual_boost": 12,
    },
    "promenade": {
        "patterns": ["promenade", "ufer", "waterfront", "boardwalk"],
        "types": {"park", "attraction"},
        "category": "activity",
        "audiences": ["date", "friends", "tourism"],
        "occasions": ["date", "friends", "tourism"],
        "indoor_outdoor": "outdoor",
        "energy_level": "low",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 60,
        "manual_boost": 10,
    },
    "rooftop": {
        "patterns": ["rooftop", "dachterrasse", "skybar", "roof"],
        "types": {"bar", "nightclub", "attraction"},
        "category": "nightlife",
        "audiences": ["date", "friends", "party", "tourism"],
        "occasions": ["date", "friends", "party", "tourism"],
        "indoor_outdoor": "mixed",
        "energy_level": "medium",
        "family_friendly": False,
        "nightlife_fit": True,
        "duration_min": 120,
        "manual_boost": 13,
    },
    "bowling": {
        "patterns": ["bowling"],
        "types": {"bowling_alley", "sports_centre"},
        "category": "activity",
        "audiences": ["date", "friends"],
        "occasions": ["date", "friends"],
        "indoor_outdoor": "indoor",
        "energy_level": "medium",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 90,
        "manual_boost": 10,
    },
    "minigolf": {
        "patterns": ["minigolf", "mini golf"],
        "types": {"miniature_golf", "attraction"},
        "category": "activity",
        "audiences": ["date", "friends", "family"],
        "occasions": ["date", "friends", "family"],
        "indoor_outdoor": "mixed",
        "energy_level": "medium",
        "family_friendly": True,
        "nightlife_fit": False,
        "duration_min": 75,
        "manual_boost": 9,
    },
    "climbing": {
        "patterns": ["kletter", "climb", "boulder"],
        "types": {"sports_centre", "fitness_centre"},
        "category": "activity",
        "audiences": ["date", "friends"],
        "occasions": ["date", "friends"],
        "indoor_outdoor": "indoor",
        "energy_level": "high",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 120,
        "manual_boost": 9,
    },
    "lasertag": {
        "patterns": ["lasertag", "laser tag", "lasergame", "laserstar"],
        "types": {"sports_centre", "attraction"},
        "category": "activity",
        "audiences": ["friends"],
        "occasions": ["friends"],
        "indoor_outdoor": "indoor",
        "energy_level": "high",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 90,
        "manual_boost": 9,
    },
    "workshop_pottery": {
        "patterns": ["pottery", "töpfer", "toepfer", "ceramic"],
        "types": {"workshop", "arts_centre", "gallery"},
        "category": "activity",
        "audiences": ["date", "friends"],
        "occasions": ["date", "friends"],
        "indoor_outdoor": "indoor",
        "energy_level": "low",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 120,
        "manual_boost": 9,
    },
    "workshop_painting": {
        "patterns": ["painting", "malen", "paint", "atelier"],
        "types": {"workshop", "arts_centre", "gallery"},
        "category": "activity",
        "audiences": ["date", "friends"],
        "occasions": ["date", "friends"],
        "indoor_outdoor": "indoor",
        "energy_level": "low",
        "family_friendly": False,
        "nightlife_fit": False,
        "duration_min": 120,
        "manual_boost": 9,
    },
    "nightclub": {
        "patterns": ["club", "nightclub", "dance", "dj", "techno", "rave"],
        "types": {"nightclub", "club", "bar"},
        "category": "nightlife",
        "audiences": ["friends", "party"],
        "occasions": ["friends", "party"],
        "indoor_outdoor": "indoor",
        "energy_level": "high",
        "family_friendly": False,
        "nightlife_fit": True,
        "duration_min": 180,
        "manual_boost": 14,
    },
    "disco": {
        "patterns": ["disco", "dance", "dj", "party"],
        "types": {"nightclub", "club", "bar"},
        "category": "nightlife",
        "audiences": ["friends", "party"],
        "occasions": ["friends", "party"],
        "indoor_outdoor": "indoor",
        "energy_level": "high",
        "family_friendly": False,
        "nightlife_fit": True,
        "duration_min": 180,
        "manual_boost": 14,
    },
    "late_food": {
        "patterns": ["döner", "doener", "pizza", "late", "24", "kebap", "kebab"],
        "types": {"fast_food", "restaurant"},
        "category": "restaurant",
        "audiences": ["friends", "party"],
        "occasions": ["friends", "party"],
        "indoor_outdoor": "indoor",
        "energy_level": "late",
        "family_friendly": False,
        "nightlife_fit": True,
        "duration_min": 30,
        "manual_boost": 8,
    },
}

OUTPUT_COLUMNS = [
    "city_slug",
    "name",
    "category",
    "type",
    "subtypes",
    "audiences",
    "occasions",
    "lat",
    "lng",
    "address",
    "website",
    "reservation_url",
    "price_level",
    "budget",
    "indoor_outdoor",
    "energy_level",
    "family_friendly",
    "nightlife_fit",
    "duration_min",
    "manual_boost",
    "data_confidence",
    "source_primary",
    "import_batch",
    "notes",
    "candidate_score",
]


def stringify_array(values: list[str]) -> str:
    return "{" + ",".join(values) + "}"


def normalize_text(*parts: object) -> str:
    return " ".join(str(part or "").strip().lower() for part in parts if part is not None)


def score_candidate(row: dict, subtype_key: str, config: dict[str, object]) -> int:
    text = normalize_text(row["name"], row["type"], row["category"], " ".join(row["tags"]))
    score = 0

    if row["type"] in config["types"]:
        score += 5
    if row["category"] == config["category"]:
        score += 3

    for pattern in config["patterns"]:
        if pattern in text:
            score += 4

    existing_subtypes = set(row["subtypes"])
    if subtype_key in existing_subtypes:
        score += 8

    if subtype_key in {"nightclub", "disco"} and row["nightlife_fit"]:
        score += 3

    if subtype_key in {"zoo", "aquarium", "playground", "children_museum", "science_center"} and row["family_friendly"]:
        score += 3

    if row["quality_score"] is not None:
        score += min(int(row["quality_score"] // 20), 4)

    if row["importance_score"] is not None:
        score += min(int(row["importance_score"] // 20), 4)

    return score


def candidate_rows(rows: list[dict], city_slug: str, import_batch: str, max_per_subtype: int) -> list[dict]:
    picked_ids: set[str] = set()
    output: list[dict] = []

    for subtype_key, config in TARGET_SUBTYPES.items():
        scored = []
        for row in rows:
            if row["id"] in picked_ids:
                continue
            score = score_candidate(row, subtype_key, config)
            if score <= 0:
                continue
            scored.append((score, row))

        scored.sort(
            key=lambda item: (
                -item[0],
                -(item[1]["quality_score"] or 0),
                -(item[1]["importance_score"] or 0),
                item[1]["name"],
            )
        )

        taken = 0
        for score, row in scored:
            if taken >= max_per_subtype:
                break

            picked_ids.add(row["id"])
            seed_subtypes = [subtype_key]
            if subtype_key == "rooftop":
                seed_subtypes = ["rooftop", "rooftop_bar", "cocktail_bar"]
            elif subtype_key == "viewpoint" and "romantic_spot" not in seed_subtypes:
                seed_subtypes = ["viewpoint", "romantic_spot"]
            elif subtype_key == "nightclub":
                seed_subtypes = ["nightclub"]
            elif subtype_key == "disco":
                seed_subtypes = ["nightclub", "disco"]

            output.append(
                {
                    "city_slug": city_slug,
                    "name": row["name"],
                    "category": config["category"],
                    "type": row["type"],
                    "subtypes": stringify_array(seed_subtypes),
                    "audiences": stringify_array(config["audiences"]),
                    "occasions": stringify_array(config["occasions"]),
                    "lat": row["lat"] or "",
                    "lng": row["lng"] or "",
                    "address": "",
                    "website": "",
                    "reservation_url": row["reservation_url"] or "",
                    "price_level": row["price_level"] or "",
                    "budget": row["budget"] or "",
                    "indoor_outdoor": config["indoor_outdoor"],
                    "energy_level": config["energy_level"],
                    "family_friendly": "true" if config["family_friendly"] else "false",
                    "nightlife_fit": "true" if config["nightlife_fit"] else "false",
                    "duration_min": config["duration_min"],
                    "manual_boost": config["manual_boost"],
                    "data_confidence": "0.90",
                    "source_primary": "manual_seed",
                    "import_batch": import_batch,
                    "notes": f"auto_candidate:{subtype_key}",
                    "candidate_score": score,
                }
            )
            taken += 1

    return output


QUERY = """
select
  id,
  name,
  type,
  category::text as category,
  lat,
  lng,
  reservation_url,
  budget,
  price_level,
  family_friendly,
  nightlife_fit,
  quality_score,
  importance_score,
  coalesce(tags, '{}'::text[]) as tags,
  coalesce(subtypes, '{}'::text[]) as subtypes
from public.locations
where city_slug = %(city_slug)s
  and is_plannable = true
  and category::text in ('activity', 'culture', 'nightlife', 'restaurant', 'cafe', 'event')
order by quality_score desc nulls last, importance_score desc nulls last, name asc;
"""


def generate_for_city(conn, city_slug: str, max_per_subtype: int, output_dir: Path):
    import_batch = city_slug.split("-")[0] + "_auto_candidates_v1"
    with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
        cur.execute(QUERY, {"city_slug": city_slug})
        rows = cur.fetchall()

    candidates = candidate_rows(rows, city_slug, import_batch, max_per_subtype)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{city_slug}_seed_candidates.csv"

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(candidates)

    counts = defaultdict(int)
    for row in candidates:
        counts[row["subtypes"]] += 1

    print(f"Wrote {len(candidates)} candidates to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate automatic manual-seed candidates from existing locations.")
    parser.add_argument(
        "--cities",
        nargs="+",
        default=["berlin-berlin", "hamburg-hamburg"],
        help="City slugs to generate candidates for",
    )
    parser.add_argument(
        "--max-per-subtype",
        type=int,
        default=3,
        help="Maximum suggestions per subtype",
    )
    parser.add_argument(
        "--output-dir",
        default="data/seed_candidates",
        help="Directory for generated CSV files",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL"),
        help="Postgres connection string; defaults to DATABASE_URL env var",
    )
    args = parser.parse_args()

    if not args.database_url:
        raise RuntimeError("DATABASE_URL missing. Pass --database-url or set DATABASE_URL in your environment.")

    with psycopg.connect(args.database_url) as conn:
        for city_slug in args.cities:
            generate_for_city(conn, city_slug, args.max_per_subtype, Path(args.output_dir))


if __name__ == "__main__":
    main()
