# Sara — prompts for Codex

How to use this file:

1. Paste **§1 Session prompt** at the start of every new Codex session.
2. Then paste **one task prompt** from §2. One task per session, or at minimum one task
   per message. Never paste two.
3. Before opening a PR, paste **§3 Self-review prompt**.

> **Why one task at a time:** given a whole plan, coding agents start "helpfully"
> refactoring files they weren't asked about. That's what creates merge conflicts with
> Paria and Ali. A bounded task is the single biggest lever you have on output quality.

---

## §1 Session prompt — paste first, every session

```
You are working on Waylo, a multi-agent travel companion app, as part of a
three-person team. Each person owns a strict slice of the repo.

I am Sara. I own Lane B: `lib/providers/**` and `lib/cache/**`. ONLY those.

Before doing anything, read these files in the repo:
- AGENTS.md          — the team's rules. They are binding.
- docs/SARA_PLAN.md  — my full task list, with verified API details and gotchas.
- types/index.ts     — the shared data contract.
- types/providers.ts — the interfaces I implement.

Hard rules for this session:
1. NEVER edit anything under `types/`. If a type or interface seems wrong, STOP and
   tell me — I will ask the lead. Do not work around it and do not define a local
   duplicate type.
2. NEVER edit `lib/agents/`, `lib/llm/`, `app/`, or `components/`. Those belong to
   teammates. If something there is broken, tell me; do not fix it.
3. NEVER add a dependency without asking me first.
4. No refactoring, renaming, or reformatting of code you were not asked to change.
   Every changed line must trace to the task I give you.
5. Never regenerate a whole file. Make surgical edits.
6. No speculative abstraction, no config layers, no "flexible" wrappers. This is a
   hackathon codebase; the minimum correct code wins.
7. Never commit an API key. Secrets live in `.env.local`, which is gitignored.
8. Never add AI attribution to commits (no "Co-Authored-By", no "Generated with").
9. Work on a branch named `lane-b/<task>` — one branch per task, never one per lane.
   NEVER commit to `main`, and never force-push anything.

Project constraints that shape every decision:
- All providers must DEGRADE, never throw. If an upstream API is down or rate-limited,
  return a valid (possibly empty or lower-confidence) result. A thrown error anywhere
  in this lane becomes a broken page for the whole team.
- Cache aggressively. We re-run the same city constantly while rehearsing the demo.
- Exa is metered: $10 total, $0.007 per search. Cache before spending.
- Nominatim allows 1 request/second and requires a real User-Agent header.

Acknowledge by listing the files you are allowed to edit. Then wait for my task.
Do not start writing code yet.
```

---

## §2 Task prompts — paste one at a time

### B1 — cache

```
Task B1 from docs/SARA_PLAN.md: implement the disk cache.

Create `lib/cache/diskCache.ts` and `lib/cache/key.ts`.

- Implement the `Cache` interface exactly as declared in `types/providers.ts`.
- Storage: JSON files at `.cache/<namespace>/<sha1(key)>.json`, each holding
  `{ value, expiresAt }`.
- `get` returns null on miss AND on expiry.
- `normalizeKey(parts)`: lowercase, collapse whitespace, sort object keys, and round
  any coordinate to 4 decimal places so near-identical queries share an entry.
- Track hits/misses for `stats()`.

Also write `scripts/test-cache.ts` that I can run with `npx tsx` proving: a set/get
round-trip, a cache miss after expiry, and correct hit/miss counts.

Do not touch any other file.
```

### B2 — http wrapper

```
Task B2 from docs/SARA_PLAN.md: implement `lib/providers/http.ts`.

Single `fetchJson<T>()` used by every provider. Signature is in the plan.

Requirements:
- AbortController timeout, default 15s, overridable (Overpass needs 30s).
- A per-host serial queue honouring `minIntervalMs`. Nominatim needs 1000ms between
  requests — this is a hard requirement of their usage policy, not a nicety.
- Retry ONCE on 5xx or timeout, with 500ms backoff. NEVER retry a 4xx.
- On every call — success or failure — report a ToolCall to `ctx.onToolCall` with
  `ms`, `ok`, `cached`, and `costUsd` when the tool is metered.

This wrapper is the only place rate limiting exists, so no provider may call `fetch`
directly afterwards.

Write `scripts/test-http.ts` proving: two rapid rate-limited calls are >=1s apart, a
500 retries once, a 400 does not retry.

Do not touch any other file.
```

### B3 — geocoding

```
Task B3 from docs/SARA_PLAN.md: implement `lib/providers/nominatim.ts` as
`GeocodeProvider` from types/providers.ts.

Endpoint and required headers are in the plan. Use `fetchJson` from B2 with
minIntervalMs 1000. Cache by normalized query with a 30-day TTL.

Important: Nominatim does NOT return a timezone, but our `Destination` type requires
one. Do not guess it and do not add a dependency. `geocode()` should accept the
timezone from its caller; `createProviders()` will wire it to the weather provider's
`timezoneFor()` later. If that seems awkward, tell me before coding around it.

Verify: "Montreal, Canada" resolves to approximately lat 45.50, lng -73.57.

Do not touch any other file.
```

### B4 — tags + normalize (the important one)

```
Task B4 from docs/SARA_PLAN.md: implement `lib/providers/tags.ts` and
`lib/providers/normalize.ts`.

`tags.ts`: the OSM-selector <-> PlaceCategory mapping. The full table is in
docs/SARA_PLAN.md — use it verbatim, do not invent your own mapping. Also map each
category to its `Interest[]` and its `ambience`.

`normalize.ts`: convert a raw OSM element into our `Place` type.
- `id` must be `osm:${type}/${id}` and stable across runs.
- Default `durationMinutes` per category, per the table in the plan.
- `confidence`: 0.9 when name/category/coords came from real tags, dropping toward 0.4
  as fields are inferred.

CRITICAL: OSM elements have no rating and almost never have a price. Leave `rating` and
`priceLevel` as `undefined`. Do NOT default rating to 0 — downstream code filters on a
minimum rating and a 0 default would silently delete every result.

CRITICAL: `ambience` drives our weather feature, which swaps outdoor plans for indoor
ones when it rains. A museum mislabelled as outdoor breaks the core demo. Be careful
and be literal about the table.

Do not touch any other file.
```

### B5 — opening hours

```
Task B5 from docs/SARA_PLAN.md: implement `lib/providers/hours.ts`.

Convert an OSM `opening_hours` tag string into our `OpeningHours` type.

Use the `opening_hours` npm package, which is already in package.json. Do NOT write a
custom parser — the OSM format supports rules like "Mo-Fr 09:00-12:00,13:00-17:00; PH off"
and a partial parser silently reports places as closed when they are open.

If parsing throws, or the tag is absent, return `{ weekly: [], unknown: true }`.
Never throw.

Do not touch any other file.
```

### B6 — Overpass

```
Task B6 from docs/SARA_PLAN.md: implement `lib/providers/overpass.ts` as
`PlaceSearchProvider`.

The endpoint, request format, and an example OverpassQL query are in the plan.

- Query BOTH `node` and `way` — large museums and parks are ways, not nodes. Use
  `out center` and take the centroid as coords.
- Multiple categories must go into ONE request as a union `( ... );`, not one request
  per category. Overpass is a fair-use volunteer service.
- Cap results with `out ... 60` and drop anything without a `name` tag.
- Cache key: rounded centre + radius + sorted category list. TTL 7 days.
- Use `tags.ts` for selectors and `normalize.ts` for the conversion. Do not duplicate
  that logic here.
- Never issue parallel Overpass requests.

Verify against museums within 2km of central Montreal.

Do not touch any other file.
```

### B7 — weather

```
Task B7 from docs/SARA_PLAN.md: implement `lib/providers/openMeteo.ts` as
`WeatherProvider`.

The full URL with parameters is in the plan. No API key needed.

VERIFIED GOTCHA: Open-Meteo returns hourly times as naive local strings like
"2026-09-12T00:00" with no offset, but our ISODateTime type requires an offset.
Convert using the `utc_offset_seconds` field in the response. If you skip this, every
downstream time comparison drifts by hours and the bug is nearly invisible.

- Map WMO weathercode to our WeatherCode using the table in the plan.
- `outdoorFriendly` per the formula in the plan — keep the thresholds as named
  constants so we can tune them.
- `badWindows`: merge consecutive non-friendly hours, and IGNORE any run shorter than
  2 hours. A single drizzly hour is not worth replanning a day around.
- `timezoneFor()` uses `timezone=auto` and returns the IANA name.
- Cache TTL 1 hour, not longer — a stale forecast defeats the entire feature.

Do not touch any other file.
```

### B8 — routing

```
Task B8 from docs/SARA_PLAN.md: implement `lib/providers/osrm.ts` as `RoutingProvider`.

READ THIS FIRST — verified on 2026-09-12: the public OSRM demo server IGNORES the
profile in the URL. Requests for `walking`, `cycling`, and `driving` between the same
two Montreal points all returned identical results: duration 251.1s, distance 1839.7m.
That is 26 km/h, i.e. the car profile answering every request. OSRM's walking and
cycling durations are therefore fiction and must not be used.

So:
- Use OSRM ONLY for `distanceMeters` and the encoded `polyline`.
- Compute `durationMinutes` yourself from distance and the per-mode speed constants in
  the plan, plus the fixed waiting overheads listed there.
- Fares are modelled, not quoted. Every modelled option must carry `confidence: 0.5`
  and an honest `note` such as "modelled estimate, not a live quote".
- If OSRM fails entirely: haversine distance x 1.3 with `confidence: 0.3`.

Do not silently present modelled numbers as precise. Do not touch any other file.
```

### B9 — Exa (spends real money)

```
Task B9 from docs/SARA_PLAN.md: implement `lib/providers/exa.ts` as `TextSearchProvider`.

Endpoint and request body are in the plan. Key comes from EXA_API_KEY in .env.local —
never hardcode it, never log it.

This provider spends real money: $0.007 per search, $10 total budget, about 1,400
searches. These guards are non-negotiable:

1. Check the cache BEFORE the budget check. Key = (normalizedQuery, city, section),
   TTL 7 days, on disk.
2. `numResults` hard-capped at 10. Results beyond 10 bill extra per result.
3. `remainingBudgetUsd()` must persist spend to disk, so a server restart does not
   reset the tally and quietly overspend.
4. `canSpend()` returns false past EXA_SOFT_CAP_RATIO of the budget. When false,
   callers fall back to Overpass. NEVER throw on budget exhaustion — degrade.
5. Every call records `costUsd: 0.007` on its ToolCall.

Verify: the same query twice spends only once, and spend survives a restart.

Do not touch any other file.
```

### B10 — Wikipedia

```
Task B10 from docs/SARA_PLAN.md: implement `lib/providers/wikipedia.ts` as
`EnrichmentProvider`.

Endpoint is in the plan. Free, no key. Returns description, photoUrl, url.

Skip the network call entirely for `eat` and `essentials` categories — Wikipedia has
nothing useful for restaurants and the round trip is wasted. Return `{}`.

Return `{}` rather than throwing whenever there is no match. TTL 30 days.

Do not touch any other file.
```

### B11 — wire it up

```
Task B11 from docs/SARA_PLAN.md: implement `lib/providers/index.ts` and
`lib/providers/usage.ts`.

Export `createProviders(env): ProviderRegistry` satisfying the interface in
types/providers.ts exactly, with no `any` and no type assertions.

- Wire nominatim's timezone lookup to openMeteo's `timezoneFor()` here. This is the
  composition point, so nominatim.ts must not import openMeteo.ts.
- `usage()` returns the live UsageMeter: Exa spend, search count, LLM call count,
  cache hit rate.
- When `ctx.mock === true`, every provider must return fixtures from
  `lib/mock/fixtures/` and make ZERO network calls. Read those fixtures; do not
  create or edit them, they belong to the lead.

Then run `npm run typecheck` and fix anything in MY files only.

Do not touch any other file.
```

---

## §3 Self-review prompt — before every PR

```
Review the diff you just produced, as a reviewer rather than the author.

Check each of these and report honestly:
1. Does every changed line trace to the task I gave you? List any that do not.
2. Did you edit any file outside `lib/providers/` and `lib/cache/`?
3. Did you rename, reformat, or refactor anything you weren't asked to?
4. Can any function throw on upstream failure instead of degrading?
5. Is any secret, key, or token present in the diff?
6. Does `npm run typecheck` pass?
7. Are there `any` types or type assertions hiding a real mismatch?

If you find violations, fix them. Do not add new features while reviewing.
```

## §4 When you're stuck

```
I am blocked on: <describe>.

Do not guess and do not work around it. Tell me:
1. What exactly is failing, with the error text.
2. Which of the three likely causes it is: my code, the upstream API, or a wrong
   assumption in docs/SARA_PLAN.md.
3. The smallest experiment that would distinguish them.

If the blocker is a type or interface in `types/`, say so explicitly — that needs the
lead to change, not us.
```

> Team rule: blocked more than 20 minutes → message the team. Grinding alone is the
> most expensive thing you can do in a hackathon.

## §5 Finishing a task — open the PR

```
The task is done and self-review is clean. Walk me through shipping it:

1. Run `npm run typecheck`. If it fails, stop and fix it — a branch that does not typecheck
   must never be merged, because `main` is what deploys.
2. Show me `git status` and `git diff --stat` so I can confirm nothing outside
   lib/providers/ and lib/cache/ changed.
3. Rebase onto the latest main:
   git pull --rebase origin main
   If there are conflicts, show them to me — do NOT resolve conflicts in a file outside my
   lane on your own, and never resolve a lockfile conflict by hand.
4. Commit with our format: `<type>(b): <what changed>`, e.g.
   `feat(b): add Overpass POI provider with tile cache`.
   No AI attribution lines of any kind.
5. Push the branch and give me the PR URL.

Then write a short PR description for me containing:
- what the task was, in one line
- anything I should know that is not obvious from the diff
- how you verified it (which script you ran, what it printed)
- anything you could NOT verify

Keep it short. Do not pad it.
```

Once the PR is open, paste its **Vercel preview URL** into the PR description — a reviewer
should be able to click the actual page instead of reading the diff and imagining it.

**Then merge it and move on.** Do not batch several finished tasks into one big merge later;
merge each task as soon as it is green. See `AGENTS.md` §6.
