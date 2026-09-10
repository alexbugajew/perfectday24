import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  autoSelectCandidate,
  haversineMeters,
  rankCandidatesByDistance,
  type PhotoMatchCandidate,
} from "../lib/admin/photo-matching";
import { locationPhotoFromSourceRefs } from "../lib/planner/location-photo";

function candidate(id: string, lat: number, lng: number): PhotoMatchCandidate {
  return { id, name: id, type: null, category: null, city_slug: "leipzig", lat, lng };
}

// Referenz: 0,001° Breite ≈ 111 m; Leipzig Zentrum als Basis.
const BASE = { lat: 51.34, lng: 12.37 };

describe("haversineMeters", () => {
  it("liefert 0 für identische Punkte", () => {
    assert.equal(haversineMeters(BASE.lat, BASE.lng, BASE.lat, BASE.lng), 0);
  });

  it("misst ~111 m pro 0,001° Breite", () => {
    const d = haversineMeters(BASE.lat, BASE.lng, BASE.lat + 0.001, BASE.lng);
    assert.ok(Math.abs(d - 111) < 2, `erwartet ~111 m, war ${d}`);
  });
});

describe("rankCandidatesByDistance", () => {
  it("sortiert nach Entfernung und rundet auf Meter", () => {
    const ranked = rankCandidatesByDistance(BASE, [
      candidate("weit", BASE.lat + 0.004, BASE.lng),
      candidate("nah", BASE.lat + 0.0001, BASE.lng),
      candidate("mittel", BASE.lat + 0.001, BASE.lng),
    ]);
    assert.deepEqual(
      ranked.map((entry) => entry.id),
      ["nah", "mittel", "weit"]
    );
    assert.ok(Number.isInteger(ranked[0].distanceM));
  });
});

describe("autoSelectCandidate", () => {
  it("wählt einen eindeutigen, nahen Treffer vor", () => {
    const ranked = rankCandidatesByDistance(BASE, [
      candidate("treffer", BASE.lat + 0.0001, BASE.lng), // ~11 m
      candidate("nachbar", BASE.lat + 0.001, BASE.lng), // ~111 m
    ]);
    assert.equal(autoSelectCandidate(ranked), "treffer");
  });

  it("verweigert die Vorauswahl bei zwei dicht beieinander liegenden Kandidaten", () => {
    // Ladenzeile: beide unter 40 m, Abstand < 25 m — Mensch muss entscheiden.
    const ranked = rankCandidatesByDistance(BASE, [
      candidate("laden-a", BASE.lat + 0.0001, BASE.lng),
      candidate("laden-b", BASE.lat + 0.0002, BASE.lng),
    ]);
    assert.equal(autoSelectCandidate(ranked), null);
  });

  it("verweigert die Vorauswahl bei zu großer Entfernung", () => {
    const ranked = rankCandidatesByDistance(BASE, [
      candidate("fern", BASE.lat + 0.001, BASE.lng), // ~111 m
    ]);
    assert.equal(autoSelectCandidate(ranked), null);
  });

  it("liefert null ohne Kandidaten", () => {
    assert.equal(autoSelectCandidate([]), null);
  });
});

describe("locationPhotoFromSourceRefs", () => {
  it("findet den photo_url-Eintrag im Array neben fremden Einträgen", () => {
    assert.equal(
      locationPhotoFromSourceRefs([
        { seed_id: "abc" },
        { address: "Musterweg 1" },
        { photo_url: "https://example.com/foto.jpg", photo_source: "owner_upload" },
      ]),
      "https://example.com/foto.jpg"
    );
  });

  it("liefert null ohne Foto-Eintrag", () => {
    assert.equal(locationPhotoFromSourceRefs([{ seed_id: "abc" }]), null);
    assert.equal(locationPhotoFromSourceRefs(null), null);
    assert.equal(locationPhotoFromSourceRefs({ photo_url: "   " }), null);
  });
});

describe("photo-refs: mergePhotoEntry / findOwnPhotoEntry", () => {
  const { mergePhotoEntry, findOwnPhotoEntry, storagePathFromPublicUrl } =
    require("../lib/admin/photo-refs") as typeof import("../lib/admin/photo-refs");

  const OLD_ENTRY = {
    photo_url: "https://x.supabase.co/storage/v1/object/public/partner-media/location-photos/abc/1.jpg",
    photo_source: "owner_upload",
    media_asset_id: "asset-1",
    storage_path: "location-photos/abc/1.jpg",
  };
  const NEW_ENTRY = { photo_url: "https://neu.jpg", photo_source: "owner_upload", media_asset_id: "asset-2" };

  it("ersetzt den eigenen Eintrag, fremde bleiben stehen", () => {
    const refs = [{ seed_id: "s" }, { address: "Musterweg 1" }, OLD_ENTRY];
    const merged = mergePhotoEntry(refs, NEW_ENTRY) as unknown[];
    assert.equal(merged.length, 3);
    assert.deepEqual(merged[0], { seed_id: "s" });
    assert.deepEqual(merged[1], { address: "Musterweg 1" });
    assert.deepEqual(merged[2], NEW_ENTRY);
  });

  it("hebt Objektform in ein Array mit beiden Einträgen", () => {
    const merged = mergePhotoEntry({ eventCategory: "concert" }, NEW_ENTRY) as unknown[];
    assert.deepEqual(merged, [{ eventCategory: "concert" }, NEW_ENTRY]);
  });

  it("findet den eigenen Eintrag samt Aufräum-Metadaten", () => {
    const found = findOwnPhotoEntry([{ seed_id: "s" }, OLD_ENTRY]);
    assert.deepEqual(found, {
      photo_url: OLD_ENTRY.photo_url,
      media_asset_id: "asset-1",
      storage_path: "location-photos/abc/1.jpg",
    });
  });

  it("liefert null ohne eigenen Eintrag", () => {
    assert.equal(findOwnPhotoEntry([{ seed_id: "s" }, { address: "x" }]), null);
    assert.equal(findOwnPhotoEntry(null), null);
  });

  it("leitet den Storage-Pfad aus der Public-URL ab", () => {
    assert.equal(
      storagePathFromPublicUrl(OLD_ENTRY.photo_url, "partner-media"),
      "location-photos/abc/1.jpg"
    );
    assert.equal(storagePathFromPublicUrl("https://fremd.example/bild.jpg", "partner-media"), null);
  });
});
