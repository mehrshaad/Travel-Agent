import assert from "node:assert/strict";

import { DiskCache } from "../lib/cache/diskCache";
import { normalizeKey } from "../lib/cache/key";

async function main(): Promise<void> {
  const cache = new DiskCache(`test-cache-${Date.now()}`);
  const locationKey = normalizeKey({
    city: "  Montréal  ",
    coords: { lat: 45.50174, lng: -73.56734 },
  });
  assert.equal(
    locationKey,
    normalizeKey({
      coords: { lng: -73.56731, lat: 45.50171 },
      city: "montréal",
    }),
  );

  assert.equal(await cache.get(locationKey), null);
  await cache.set(locationKey, { name: "Montreal" }, 60);
  assert.deepEqual(await cache.get(locationKey), { name: "Montreal" });

  await cache.set("expired", { name: "Old value" }, 0);
  assert.equal(await cache.get("expired"), null);

  assert.deepEqual(cache.stats(), {
    hits: 1,
    misses: 2,
    hitRate: 1 / 3,
    entries: 1,
  });

  console.log("Cache round-trip, expiry, and stats checks passed.");
}

void main();
