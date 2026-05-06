import os
import json
import psycopg
import osmium
from shapely.geometry import Point
from shapely.wkb import dumps as wkb_dumps
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
PBF_PATH = os.getenv("PBF_PATH")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL missing in .env")
if not PBF_PATH:
    raise RuntimeError("PBF_PATH missing in .env")

class RestaurantHandler(osmium.SimpleHandler):
    def __init__(self, conn):
        super().__init__()
        self.conn = conn
        self.batch = []
        self.count = 0

    def flush_batch(self):
        if not self.batch:
            return

        sql = """
        insert into public.osm_places_raw (osm_type, osm_id, tags, geom)
        values (%s, %s, %s::jsonb,
            case
                when %s is null then null
                else st_setsrid(st_geomfromwkb(decode(%s,'hex')), 4326)
            end
        )
        on conflict (osm_type, osm_id)
        do update set
            tags = excluded.tags,
            geom = coalesce(excluded.geom, public.osm_places_raw.geom),
            imported_at = now();
        """

        expanded = []
        for osm_type, osm_id, tags_json, wkb_hex in self.batch:
            expanded.append((osm_type, osm_id, tags_json, wkb_hex, wkb_hex))

        with self.conn.cursor() as cur:
            cur.executemany(sql, expanded)

        self.conn.commit()
        self.batch = []

    def node(self, n):
        if n.tags.get("amenity") == "restaurant":
            if n.location and n.location.valid():
                point = Point(n.location.lon, n.location.lat)
                wkb_hex = wkb_dumps(point, hex=True, srid=4326)
            else:
                wkb_hex = None

            self.batch.append((
                "node",
                int(n.id),
                json.dumps(dict(n.tags)),
                wkb_hex
            ))
            self.count += 1

            if len(self.batch) >= BATCH_SIZE:
                self.flush_batch()
                print(f"Imported {self.count} restaurants...")

def main():
    print("Starting import...")
    print("Reading:", PBF_PATH)

    with psycopg.connect(DATABASE_URL) as conn:
        handler = RestaurantHandler(conn)
        handler.apply_file(PBF_PATH, locations=True)
        handler.flush_batch()

        print("Raw import complete.")
        print("Refreshing domain table...")

        with conn.cursor() as cur:
            cur.execute("select public.pd24_refresh_restaurants_from_raw();")
        conn.commit()

        print("Done.")
        print("Total restaurants imported:", handler.count)

if __name__ == "__main__":
    main()