import argparse
import csv
from collections import defaultdict
from pathlib import Path


def load_candidates(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def print_summary(rows: list[dict[str, str]], city_label: str):
    print(f"\n=== {city_label} ===")
    print(f"Total candidates: {len(rows)}")

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row.get("subtypes", "")].append(row)

    for subtype in sorted(grouped.keys()):
        bucket = grouped[subtype]
        print(f"\n{subtype} ({len(bucket)})")
        top = sorted(
            bucket,
            key=lambda row: int((row.get("candidate_score") or "0").strip() or "0"),
            reverse=True,
        )[:5]
        for row in top:
            score = row.get("candidate_score", "")
            name = row.get("name", "")
            category = row.get("category", "")
            loc_type = row.get("type", "")
            notes = row.get("notes", "")
            print(f"  - [{score}] {name} | {category}/{loc_type} | {notes}")


def main():
    parser = argparse.ArgumentParser(description="Review generated seed candidate CSV files.")
    parser.add_argument(
        "csv_files",
        nargs="+",
        help="One or more candidate CSV files",
    )
    args = parser.parse_args()

    for csv_file in args.csv_files:
        path = Path(csv_file)
        rows = load_candidates(path)
        print_summary(rows, path.stem)


if __name__ == "__main__":
    main()
