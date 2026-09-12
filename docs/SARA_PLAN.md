# Sara — Lane B: Data & Tools

**You own:** `lib/providers/**` and `lib/cache/**`. Nothing else.
**Read first:** [`AGENTS.md`](../AGENTS.md) — especially §1 (never edit `types/`) and §3.

Your job: turn six external APIs into one clean `ProviderRegistry`. **No LLM work in
this lane.** Everything you build is deterministic and verifiable, which means you can
test it without waiting on anyone.

You are unblocked right now. Nothing you need depends on Paria or the UI.

---

## Your contract

```ts
import type { ProviderRegistry } from "@/types/providers";
```

`types/providers.ts` defines every interface you implement. **Read it before writing
code.** You do not edit it — if a signature is wrong, message Ali, don't work around it.

Your final export:

```ts
// lib/providers/index.ts
export function createProviders(env: Env): ProviderRegistry
```

---

## Setup

```bash
git checkout -b lane-b/b1-cache
npm install
cp .env.example .env.local   # fill EXA_API_KEY, set NOMINATIM_USER_AGENT
npm run typecheck
```

---

## Files you will create

```
lib/cache/
  diskCache.ts       Cache impl — JSON files under .cache/, TTL per entry
  key.ts             normalizeKey(parts) -> stable string
lib/providers/
  index.ts           createProviders() — wires everything, exports registry
  http.ts            fetchJson w/ timeout, retry, rate limit, ToolCall reporting
  nominatim.ts       GeocodeProvider
  overpass.ts        PlaceSearchProvider
  openMeteo.ts       WeatherProvider
  osrm.ts            RoutingProvider
  exa.ts             TextSearchProvider
  wikipedia.ts       EnrichmentProvider
  tags.ts            OSM tag <-> PlaceCategory mapping  ← highest-value file
  normalize.ts       raw source -> Place                ← highest-value file
  hours.ts           OSM opening_hours -> OpeningHours
  usage.ts           UsageMeter accumulator
```

---

## Task order

Do them in this order. Each is independently testable — write a tiny script under
`scripts/` and run it with `npx tsx` rather than waiting for the UI.

### B1 — `cache/diskCache.ts` + `cache/key.ts`

Everything else depends on this, so it goes first.

- JSON files under `.cache/<namespace>/<sha1(key)>.json`, envelope `{ value, expiresAt }`
- `get` returns `null` on miss **or** expiry
- `normalizeKey`: lowercase, collapse whitespace, sort object keys, round coords to
  4 decimals (~11 m) so near-identical queries share a cache entry
- Track hits/misses for `stats()`

**Why it's first:** a hackathon demo re-runs the same city dozens of times. With this,
every rerun after the first is free and instant. Without it you will burn the Exa
credit on demo rehearsals.

✅ **Done when:** same key twice → one miss then one hit; expired entry → miss.

### B2 — `http.ts`

One wrapper every provider uses. Not optional — the rate limiting lives here.

```ts
export async function fetchJson<T>(opts: {
  url: string; method?: "GET" | "POST"; body?: unknown;
  headers?: Record<string, string>; timeoutMs?: number;
  tool: ToolName; rateLimitKey?: string; minIntervalMs?: number;
  ctx?: ProviderContext;
}): Promise<T>
```

Must do:
- `AbortController` timeout, default 15s (Overpass: 30s)
- Per-host serial queue honouring `minIntervalMs` (**Nominatim needs 1000 ms**)
- One retry on 5xx/timeout with 500 ms backoff. **Never retry a 4xx.**
- Report a `ToolCall` to `ctx.onToolCall` on every call, success or failure, with
  `ms`, `cached`, `ok`, and `costUsd` when metered

✅ **Done when:** two rapid Nominatim calls are ≥1s apart; a 500 retries once; a 400 doesn't.

### B3 — `nominatim.ts`

```
GET https://nominatim.openstreetmap.org/search
    ?q=<query>&format=jsonv2&limit=1&addressdetails=1
Headers: User-Agent: <NOMINATIM_USER_AGENT>   ← required, they block generic agents
```

Map to `Destination`. Cache by normalized query, **TTL 30 days** — city coordinates
don't move.

⚠️ **Nominatim does not return a timezone**, but `Destination.timezone` is required.
Get it from Open-Meteo's `timezone=auto` (verified: returns `"America/Toronto"`).

**Resolved in the contract:** `types/providers.ts` now declares `GeocodeDeps` and
`GeocodeProviderFactory`. Export your geocoder as a factory taking `{ resolveTimezone }`;
`createProviders()` passes the weather provider's `timezoneFor`. That is why `geocode()`
has no timezone argument — the dependency arrives at construction, so `nominatim.ts`
never imports `openMeteo.ts`.

✅ **Done when:** `"Montreal, Canada"` → `{ lat≈45.50, lng≈-73.57, city:"Montréal", country:"Canada", timezone:"America/Toronto" }`

### B4 — `tags.ts` + `normalize.ts` ← **the two files that decide demo quality**

Every ranking decision downstream is capped by how well you do this. Spend real time here.

`tags.ts` — bidirectional map:

| PlaceCategory | OSM selector | ambience |
|---|---|---|
| `museum` | `tourism=museum` | indoor |
| `gallery` | `tourism=gallery` or `tourism=artwork` | indoor |
| `landmark` | `tourism=attraction` | mixed |
| `historic` | `historic=*` | mixed |
| `park` | `leisure=park` | outdoor |
| `viewpoint` | `tourism=viewpoint` | outdoor |
| `cafe` | `amenity=cafe` | indoor |
| `restaurant` | `amenity=restaurant` | indoor |
| `bakery` | `shop=bakery` | indoor |
| `bar` | `amenity=bar` or `amenity=pub` | indoor |
| `bookstore` | `shop=books` | indoor |
| `shopping` | `shop=mall` or `shop=department_store` | indoor |
| `nightlife` | `amenity=nightclub` | indoor |
| `hotel` | `tourism=hotel` | indoor |
| `hostel` | `tourism=hostel` | indoor |
| `pharmacy` | `amenity=pharmacy` | indoor |
| `grocery` | `shop=supermarket` | indoor |
| `convenience` | `shop=convenience` | indoor |
| `atm` | `amenity=atm` | outdoor |
| `laundry` | `shop=laundry` or `amenity=laundry` | indoor |
| `restroom` | `amenity=toilets` | indoor |
| `luggage_storage` | `amenity=luggage_locker` | indoor |
| `tourist_info` | `tourism=information` | mixed |
| `parking` | `amenity=parking` | outdoor |
| `transit_stop` | `public_transport=station` | mixed |
| `bike_share` | `amenity=bicycle_rental` | outdoor |
| `gas_station` | `amenity=fuel` | outdoor |

Also map every category to `Interest[]`. This is the canonical table — use it verbatim,
an empty list is a valid answer, and `free` means "costs nothing to enter", not "cheap":

| Category | Interests |
|---|---|
| `museum` | `history`, `culture`, `art` |
| `gallery` | `art`, `culture` |
| `landmark` | `history`, `culture` |
| `historic` | `history`, `culture` |
| `park` | `nature`, `walking`, `free`, `family` |
| `viewpoint` | `nature`, `walking`, `free` |
| `bookstore` | `books`, `culture`, `free` |
| `restaurant` | `food` |
| `cafe` | `coffee`, `food` |
| `bakery` | `food`, `coffee` |
| `bar` | `nightlife`, `food` |
| `nightlife` | `nightlife` |
| `shopping` | `shopping` |
| `event` | `culture`, `family` |
| `tourist_info` | `culture`, `free` |
| `hotel`, `hostel`, `rental` | *(none — stay is not an interest)* |
| `transit_stop`, `parking`, `bike_share`, `gas_station` | *(none)* |
| `pharmacy`, `grocery`, `convenience`, `atm`, `laundry`, `restroom`, `luggage_storage`, `sim_provider` | *(none — essentials are looked up on demand, never ranked by interest)* |

> ⚠️ **`ambience` correctness IS the weather demo.** The whole hero moment is "rain →
> swap outdoor for indoor." One museum tagged `outdoor` and the demo makes the product
> look broken in front of judges. Get this table right, then spot-check ~20 real results.

`normalize.ts` — `Place` from any source. Rules:

- `id`: `osm:${type}/${id}` — stable across runs, the UI dedupes on it
- `durationMinutes` defaults by category: museum 90, gallery 60, park 45,
  landmark 30, cafe 45, restaurant 75, viewpoint 20, essentials 15
- `avgCost` estimate by category + `priceLevel`
- `confidence`: 0.9 when name + category + coords came from real tags;
  drop toward 0.4 as fields are inferred

> ⚠️ **OSM has no ratings and almost never has prices.** `rating` and `priceLevel` are
> `undefined` for nearly every OSM place. Do **not** invent them, and do **not** default
> `rating` to 0 — that would silently fail `minRating` filters and delete every result.
> Leave them `undefined` and let Paria's ranking treat absence as "unknown", not "bad".
> Message Ali when you hit this; it changes how `minRating` is applied.

✅ **Done when:** 20 spot-checked Montreal places have correct `ambience`, sane
`durationMinutes`, and no fabricated ratings.

### B5 — `hours.ts`

Use the `opening_hours` npm package (already in `package.json`). **Do not write your own
parser** — the OSM format has rules like `Mo-Fr 09:00-12:00,13:00-17:00; PH off` and a
hand-rolled subset parser will silently produce wrong "closed" answers.

⚠️ **Public-holiday rules need a country.** Verified: `new opening_hours("Mo-Fr 09:00-12:00,13:00-17:00; PH off")`
throws `Country code missing which is needed to select the correct holidays`. Passing a
nominatim-shaped second argument fixes it:

```ts
new OpeningHours(raw, { address: { country_code: countryCode }, lat, lon })
```

**Resolved in the contract:** `PlaceSearchQuery.countryCode` now carries ISO 3166-1
alpha-2 (lowercase) from `Destination.country`. Thread it through to `hours.ts`. When it
is absent, a tag containing `PH`/`SH` must degrade to `{ unknown: true }` — never throw.

When parsing throws or the tag is missing → `{ weekly: [], unknown: true }`.

> The UI renders "hours unknown" for `unknown: true` and never "closed". Getting this
> wrong tells users a place is shut when it isn't.

✅ **Done when:** a split-hours tag round-trips correctly; a garbage tag yields `unknown: true` and no throw.

### B6 — `overpass.ts`

```
POST https://overpass-api.de/api/interpreter
Content-Type: application/x-www-form-urlencoded
Body: data=<OverpassQL>
```

```
[out:json][timeout:25];
(
  node["tourism"="museum"](around:2000,45.5017,-73.5673);
  way["tourism"="museum"](around:2000,45.5017,-73.5673);
);
out center tags 60;
```

- Query `node` **and** `way` — big museums and parks are ways, not nodes.
  `out center` gives you a centroid for ways; use it as `coords`.
- Multiple categories → multiple statements inside one `( … );` union. **One request,
  not one per category.**
- Cap with `out ... 60`. Drop results with no `name` tag.
- Cache key: rounded centre + radius + sorted categories. **TTL 7 days.**
- Fair-use service: never fire parallel Overpass requests. Serialize them in `http.ts`.

✅ **Done when:** museums within 2 km of central Montreal come back with names, coords,
categories, and parsed hours — in one HTTP call.

### B7 — `openMeteo.ts`

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=&longitude=
  &hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weathercode,windspeed_10m
  &daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset
  &timezone=auto&start_date=&end_date=
```

No key, no signup, free. `timezone=auto` also gives you `timezone` + `utc_offset_seconds`
— that's how `timezoneFor()` works.

> ⚠️ **Verified gotcha:** hourly times come back **naive local** — `"2026-09-12T00:00"`,
> no offset. Our `ISODateTime` requires an offset. Convert using `utc_offset_seconds`
> before returning, or every downstream time comparison silently drifts by hours.

WMO `weathercode` → our `WeatherCode`:

| WMO | ours |
|---|---|
| 0 | `clear` |
| 1–3, 45, 48 | `cloudy` (45/48 → `fog`) |
| 51–57, 61–65, 80–82 | `rain` (65, 82 → `heavy_rain`) |
| 66–67, 71–77, 85–86 | `snow` |
| 95–99 | `storm` |

`outdoorFriendly` — start with this, it is tunable:

```ts
precipitationChance < 50 && precipitationMm < 0.5 &&
tempC > -5 && tempC < 35 && windKph < 40
```

`badWindows`: merge consecutive `outdoorFriendly === false` hours. **Ignore runs shorter
than 2 hours** — a single drizzly hour is not worth replanning a day around, and a
twitchy replanner reads as broken rather than smart. `severity` from precipitation
amount + duration.

**Resolved in the contract:** `WeatherForecast.tripId` is now **optional**. A forecast is
trip-agnostic, so the provider leaves it unset and the API layer attaches it. Do not add a
`tripId` parameter to `forecast()`.

Cache TTL **1 hour** — forecasts change, and a stale forecast defeats the entire feature.

✅ **Done when:** a 4-day Montreal forecast returns hours with correct offsets, and
`badWindows` matches what you see on a weather site.

### B8 — `osrm.ts`

```
GET https://router.project-osrm.org/route/v1/{profile}/{lng1},{lat1};{lng2},{lat2}
    ?overview=full&geometries=polyline
```

> 🚨 **Verified 2026-09-12: the public OSRM demo server ignores the profile.**
> `walking`, `cycling`, and `driving` all returned **identical** results for the same
> Montreal pair — `duration: 251.1s, distance: 1839.7m`. That is 26 km/h: the car
> profile is answering every request. **OSRM walking/cycling durations are fiction.**

So: **use OSRM for `distanceMeters` and `polyline` only.** Compute duration yourself.

```ts
const SPEEDS_KMH = { walk: 4.8, bike: 15, car: 30, rideshare: 30, transit: 18 };
durationMinutes = (distanceMeters / 1000) / SPEEDS_KMH[mode] * 60;
```

Add fixed overheads: rideshare +5 min wait, transit +8 min wait/transfer.

Fares (all `confidence: 0.5`, all need `note`):
- `walk` / `bike`: $0 (bike-share day pass is out of scope)
- `transit`: flat city fare, config constant — `note: "flat fare estimate"`
- `rideshare`: `base 3.50 + 1.75/km`, `note: "modelled estimate, not a live quote"`
- `car`: fuel + parking guess

> Mark every modelled number honestly via `confidence` and `note`. The UI shows
> estimates as estimates. Do not fake precision — a judge who asks "is that a real Uber
> price?" and gets a straight answer costs you nothing; one who catches a fake number
> costs you the demo.

If OSRM fails: fall back to haversine × 1.3 (street-network detour factor), `confidence: 0.3`.

✅ **Done when:** walk/bike/car/transit return plausibly *different* durations, each
carrying an honest `confidence` and `note`.

### B9 — `exa.ts` ← **the one that spends real money**

**Canonical reference: https://docs.exa.ai/reference/search-api-guide-for-coding-agents**
If anything below contradicts real API behaviour, that URL wins — fetch it and tell the team.

```
POST https://api.exa.ai/search
Headers: x-api-key: <EXA_API_KEY>, Content-Type: application/json
Body: {
  "query": "...",
  "type": "auto",
  "numResults": 10,
  "contents": { "highlights": true }
}
```

Note: Exa's own quickstart shows the **Python** SDK (`exa_py`). We are on TypeScript, so call the
REST endpoint directly with `fetch` — the JSON body above is the same either way. Raw JSON and the
JS SDK use **camelCase** (`numResults`, `maxCharacters`); only the Python SDK uses snake_case.

**Use `highlights`, not `text`.** Highlights return query-relevant excerpts, which keep token cost
predictable. Only request `text` (always with `maxCharacters`) if something downstream genuinely
needs whole-page context.

⚠️ **Parameter traps — these are the ones that actually bite:**

- `text`, `highlights` and `summary` must be **nested inside `contents`** on `/search`. They are
  top-level only on `/contents`. Getting this wrong silently returns no content.
- `useAutoprompt` — deprecated, remove it.
- `livecrawl: "always"` — deprecated. Use `contents.maxAgeHours: 0` for a forced refresh.
- `includeUrls` / `excludeUrls` do not exist — it is `includeDomains` / `excludeDomains`.
- `numSentences`, `highlightsPerUrl`, `tokensNum` — all gone. Use `highlights: true` and
  `contents.text.maxCharacters`.

**Search type, and what it costs us.** `type` changes the price, so it is a budget decision:

| type | latency | price | use it for |
|---|---|---|---|
| `instant` | ~250 ms | $7 / 1k | quick lookups |
| `fast` | ~450 ms | $7 / 1k | latency-sensitive paths |
| `auto` | ~1 s | $7 / 1k | **our default** |
| `deep-lite` / `deep` | 4–15 s | **$12 / 1k** | only if we ever need multi-source synthesis |
| `deep-reasoning` | 12–40 s | **$15 / 1k** | not on this budget |

> Stay on `auto`. A `deep` search costs nearly **double** and our whole budget is ~1,400 searches.
> Do not switch types without saying so — it changes the burn rate immediately.

**Budget: $0.007/search on `auto`, $10 total ≈ 1,400 searches.** Verified against
`docs.exa.ai/reference/pricing`. Non-negotiable guards:

1. **Cache before spending.** Key = `(normalizedQuery, city, section)`, **TTL 7 days**, on disk.
   Check the cache *before* the budget check.
2. **`numResults` hard-capped at 10.** Results past 10 bill extra per result.
3. `remainingBudgetUsd()` = `EXA_BUDGET_USD − spent`, persisted to disk so a server restart doesn't
   reset the tally and quietly overspend.
4. `canSpend()` → `false` past `EXA_SOFT_CAP_RATIO` (0.8). Callers then fall back to Overpass.
   **Never throw** — degrade.
5. Every call records `costUsd` on its `ToolCall`.

Add a query suffix for local flavour: `` `${query} in ${city} — local recommendations, not tourist traps` ``

**Optional, later:** `outputSchema` on `/search` returns grounded structured JSON in
`output.content` with per-field citations in `output.grounding`, and works on `auto` — so it does
not force a pricier type. That could let Exa hand back `{name, address, why}` directly instead of us
parsing prose. Worth a try **only after** the cheap path works; keep schemas flat (max depth 2,
max 10 properties).

✅ **Done when:** the same query twice spends once; spend is still correct after a restart; crossing
the soft cap flips `canSpend()` to false instead of throwing.

### B10 — `wikipedia.ts`

```
GET https://<lang>.wikipedia.org/api/rest_v1/page/summary/<title>
```

Free, no key. Great for landmarks and museums, useless for restaurants — skip the call
for `eat` and `essentials` categories rather than wasting a round trip.

Returns `{ description, photoUrl, url }`. **TTL 30 days.**

✅ **Done when:** "Notre-Dame Basilica" returns a real description and thumbnail; a
random café returns `{}` without erroring.

### B11 — `index.ts` + `usage.ts`

Wire everything into `createProviders(env: ProviderEnv): ProviderRegistry`.

**Resolved in the contract:** `ProviderEnv` is now declared in `types/providers.ts` with
`EXA_API_KEY`, `EXA_BUDGET_USD`, `EXA_SOFT_CAP_RATIO`, `NOMINATIM_USER_AGENT` and
`MOCK_MODE`. Read `process.env` at the edge and pass the object in — providers must never
touch `process.env` themselves, so they stay testable and a missing key fails in one place. `usage()` returns the
live `UsageMeter` (Exa spend, searches, LLM calls, cache hit rate) — the UI renders it
as a credit-burn meter.

When `ctx.mock === true`, every provider returns fixtures from `lib/mock/fixtures/`
(Ali provides these) and makes **zero** network calls.

✅ **Done when:** `createProviders()` satisfies `ProviderRegistry` with `tsc --noEmit`
clean, and `mock: true` makes no network calls at all.

---

## Definition of done (all of it)

- [ ] `npm run typecheck` clean
- [ ] Every provider returns the exact interface type — no `any`, no casts
- [ ] Every provider degrades instead of throwing when its upstream is down
- [ ] Every network call reports a `ToolCall` with `ms`, `ok`, `cached`
- [ ] Cache hit on second identical call, verified
- [ ] Exa spend tracked and capped, verified across a restart
- [ ] No API key in any committed file

## Rules that will bite you

- **Never edit `types/`.** Wrong signature → message Ali.
- **Never edit `lib/agents/` or `lib/llm/`** — those are Paria's.
- **One branch per task**, not one per lane — `lane-b/<task>`. Merge it as soon as
  the task is done. A branch open longer than a day is too big; split it. See `AGENTS.md` §6.
- Rebase on `main` twice a day: `git pull --rebase origin main`
- Commit style: `feat(b): add Overpass POI provider with tile cache`
- No AI attribution in commits.
- **Blocked >20 min → say so.** Especially on Overpass throttling or an Exa surprise.
