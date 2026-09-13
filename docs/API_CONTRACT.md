# Waylo — API Contract v0.1

Source of truth for types: [`types/index.ts`](../types/index.ts). This document defines
the wire shape; the TS file defines the data shape. **If they disagree, the TS file wins.**

## Conventions

- Base path: `/api`
- Every JSON response is wrapped: `ApiResponse<T>` = `{ ok, data | error, meta }`
- All timestamps are `ISODateTime` **with an offset**, in the destination's timezone. Never naive.
- Money is always `{ amount, currency }`. No bare numbers.
- Append `?trace=1` to any endpoint to get `meta.traces: AgentTrace[]` — this is what
  the agent-activity panel renders.
- Append `?mock=1` to get deterministic fixtures with no LLM/Exa calls.
  **Build the UI against this first.** It is the parallel-work contract.

### Error semantics

| Code | HTTP | Meaning | UI should |
|---|---|---|---|
| `bad_request` | 400 | Bad/missing params | Show field error |
| `not_found` | 404 | Unknown trip/item | Route to trip list |
| `rate_limited` | 429 | Upstream throttle (Nominatim/Overpass/OpenRouter free tier) | Retry w/ backoff, keep stale data |
| `upstream_failed` | 502 | Data provider down | Degrade: render cached, mark stale |
| `llm_failed` | 502 | Model returned unparseable JSON after retries | Fall back to rule-based ranking |
| `budget_exhausted` | 402 | Exa credit spent | Disable free-text search, keep OSM search |
| `internal` | 500 | — | Generic error |

**Degradation is a first-class path, not an edge case.** Free models rate-limit and
return malformed JSON. Every agent has a non-LLM fallback; responses stay the same
shape, with `confidence` dropping and `meta.cached` set.

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/trips` | Create trip from natural language or form |
| `GET` | `/api/trips/:id` | Fetch trip |
| `POST` | `/api/trips/:id/plan` | Build/rebuild itinerary (**SSE**) |
| `GET` | `/api/trips/:id/itinerary` | Current itinerary |
| `PATCH` | `/api/trips/:id/items/:itemId` | Move / lock / skip / complete an item |
| `POST` | `/api/trips/:id/replan` | Evaluate "does today's plan still make sense?" (**SSE**) |
| `POST` | `/api/trips/:id/replan/:eventId/accept` | Accept or undo a proposed replan |
| `GET` | `/api/trips/:id/recommendations` | Ranked places by section/category/query |
| `GET` | `/api/trips/:id/weather` | Forecast + `badWindows` |
| `POST` | `/api/trips/:id/now` | ✨ "What should I do now?" |
| `POST` | `/api/trips/:id/signals` | Batch behavior signals |
| `GET` | `/api/trips/:id/profile` | Learned `UserProfile` + `changeLog` |
| `POST` | `/api/trips/:id/expenses` | Log spend |
| `POST` | `/api/transport/compare` | Mode comparison between two points |
| `GET` | `/api/trips/:id/events` | **SSE** — subscribe to all agent activity |

---

### `POST /api/trips`

Request: `CreateTripRequest`. Either `prompt` (parsed by Orchestrator) or structured
fields. Structured fields win on conflict.

```json
{ "prompt": "I'm in Toronto for three days from Sep 15. $120 a day. I like art, coffee, walking, and hidden local places." }
```

Response `data: Trip`. Status is `draft` — no itinerary yet. Geocoding runs here
(Nominatim), so `destination.coords` and `destination.timezone` are populated.

Parse failure does **not** 400. Unresolved fields come back as defaults and the UI
shows a confirm step. Only an unresolvable destination is a hard error.

---

### `POST /api/trips/:id/plan` — SSE

Request: `PlanRequest`. Responds `text/event-stream` of `StreamEvent`.

```
event: plan.started      data: {"type":"plan.started","tripId":"t_1","agents":["weather","attractions","food","transport","personalizer","itinerary"]}
event: agent.update      data: {"type":"agent.update","trace":{...AgentTrace, status:"running"}}
event: agent.update      data: {"type":"agent.update","trace":{...AgentTrace, status:"done"}}
event: itinerary.partial data: {"type":"itinerary.partial","day":{...ItineraryDay}}
event: usage             data: {"type":"usage","usage":{...UsageMeter}}
event: itinerary.complete data: {"type":"itinerary.complete","itinerary":{...Itinerary}}
event: done              data: {"type":"done"}
```

Days stream in order, so the UI renders Day 1 while Day 3 is still planning.
Free models take 10–40s per agent — **do not build a blocking spinner.**

Order: Weather runs first (it constrains everything), then Attractions/Food/Local in
parallel, then Transport (needs chosen places), then Personalizer ranks, then the
Itinerary agent schedules.

---

### `POST /api/trips/:id/replan` — SSE

Request: `ReplanRequest`. Emits `replan.proposed` with a `ReplanEvent`, then `done`.

The itinerary is **not mutated yet** — `accepted: null`. The UI shows a banner:

> 🌧️ Heavy rain 2–5 PM. I moved Mount Royal to tomorrow morning and put the Fine Arts
> Museum in its place. **[Accept] [Keep original]**

`POST /api/trips/:id/replan/:eventId/accept` with `{ "accepted": true|false }`
applies or discards it. Accepting bumps `itinerary.version`.

Locked items (`item.locked === true`) are never moved. If a replan is impossible
without touching a locked item, it returns `changes: []` and a `decision` explaining why.

---

### `GET /api/trips/:id/recommendations`

Query: `RecommendRequest` flattened (`?section=eat&category=cafe&limit=10&openNow=true`).

- Structured filters → **Overpass** (free, unlimited-ish)
- `query` free-text ("quiet café with wifi", "hidden local spots") → **Exa** (metered)

Response `data: Recommendation[]`, pre-sorted by `score` desc. Every item carries a
populated `why` — the UI must render it, that explanation is the product.

`openNow` is `undefined`, not `false`, when hours are unknown. Render "hours unknown",
never "closed".

---

### `POST /api/trips/:id/now`

Request: `NowRequest`. Response `data: NowSuggestion`.

Inputs the agent actually reads: current location, current time, next scheduled item,
live weather hour, remaining daily budget, opening hours, `UserProfile`, nearby places.

`options` is 1–3 `Recommendation`s so the UI is a card stack, not a wall of text.
`narrative` is the companion voice; `headline` is the one-liner.

---

### `POST /api/trips/:id/crew`

What the Crew screen asks. Request `{ trip, itinerary, question, location? }` — the trip and
the plan travel with the question because the server keeps no state between requests.

Response `data`: `{ agent, role, color, text, itinerary, change, dayNumber }`.

Routing is by keyword (`lib/crew.ts`), never by a model call. The day is resolved from the
question ("tomorrow", a weekday, "day 2", or the day they are on) so an answer about
tomorrow is grounded in tomorrow's stops, forecast and remaining budget rather than in
whatever is open right now. Nearby suggestions are picked one-per-category, because
Overpass returns far more cafés than museums and a plain top-six was six places to eat.

`itinerary` is non-null only when the plan actually changed; the client caches it and every
other screen picks it up. The model classifies the intent, never the result — the edit
itself is deterministic. A named stop that cannot be found changes nothing and is reported
as such.

---

### `GET /api/trips/:id/stays`

`?lat&lng&radius&country&stops=lat,lng|…`. Real lodging from Overpass, ranked by mean
walking distance to the stops the caller sends. No prices: OpenStreetMap has no nightly
rates, and inventing one is worse than omitting it.

---

### `GET /api/trips/:id/essentials`

`?lat&lng&radius&country`. Pharmacies, groceries, ATMs, laundry and tourist info near the
traveller, grouped by kind with real distances. Opening hours only where OSM has them;
`openNow` stays undefined when they are unknown, so nothing is ever claimed to be shut.

---

### `GET /api/trips/:id/suggestions`

Interest chips the destination can actually satisfy, counted from Overpass. An interest is
offered only when the city has at least three of them.

---

### `POST /api/trips/:id/signals`

Request: `{ "signals": BehaviorSignal[] }`. Batched — flush on an interval or on
route change, not per event.

Response `data: UserProfile`. Fires `profile.updated` on the SSE channel so the
Learning panel animates when a preference actually shifts.

`dwell` signals below 1500 ms are dropped server-side. Don't filter client-side.

---

### `GET /api/trips/:id/events` — SSE

Long-lived channel for everything the agents do outside a request/response: background
weather polls, proactive replan proposals, profile updates, usage meter. The UI opens
this once on trip load.

---

## Data providers

| Need | Provider | Cost | Limit that matters |
|---|---|---|---|
| Geocoding | Nominatim (OSM) | free | **1 req/s**, must send real `User-Agent`. Cache by query string. |
| POI search | Overpass API | free | Fair-use. Heavy queries get throttled — bbox + `[timeout:25]`, cache per tile. |
| Free-text / local knowledge | **Exa** `/search` | **$0.007/req** (first 10 results) | $10 ≈ **1,400 searches**. See budget rules below. |
| Page contents | Exa `/contents` | $0.001/page | Only fetch for places that reach the itinerary. |
| Weather | Open-Meteo | free | No key, no signup. Hourly + daily. |
| Routing | OSRM demo server | free | Public demo — walk/bike/car only, **no transit**. Fair-use; self-host if throttled. |
| Place descriptions | Wikipedia REST | free | Good for landmarks, useless for restaurants. |
| LLM | OpenRouter free tier | free | Rate-limited, slow, unreliable JSON. Plan for it. |

*Verified 2026-09-12 against `openrouter.ai/api/v1/models` and `docs.exa.ai/reference/pricing`.*

### Transit is the gap

OSRM has no public transit. Options: hardcode the demo city's fare and estimate
duration as `walk_time * 0.45 + 8min`, or wire one city's GTFS. `TransportOption.confidence`
and `note` exist so the UI can honestly mark it as an estimate. **Do not fake precision.**

### LLM models (free, tool-capable — verified)

| Model | Context | Use for |
|---|---|---|
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1M | Orchestrator, replan reasoning |
| `google/gemma-4-31b-it:free` | 262k | Per-agent extraction/ranking |
| `nvidia/nemotron-3.5-lightning:free` | 1M | Fast paths, `now` suggestions |
| `openrouter/free` | 200k | Auto-router fallback |

Never trust free-tier tool-calling. Use **strict JSON output + schema validation +
one retry + rule-based fallback**. Every agent must produce a valid response without
the LLM.

### Exa budget rules

$10 ≈ 1,400 searches. Burn it on the differentiator — "hidden local places",
local tourism sites, events — not on things Overpass answers for free.

1. Overpass first for anything structured (category + radius + hours).
2. Exa only for free-text queries and local-knowledge enrichment.
3. Cache every Exa response keyed by `(normalized_query, city, section)`, TTL 7 days,
   on disk. A hackathon demo re-runs the same city dozens of times — cache makes that free.
4. Cap `numResults` at 10 (above 10 costs extra per result).
5. Every call records `ToolCall.costUsd`; `UsageMeter` exposes the running total.
   At 80% of budget, free-text search degrades to Overpass and returns
   `budget_exhausted` for explicit Exa-only requests.

---

## Open decisions

1. **Stack** — this contract assumes TypeScript/Next.js so the UI imports `types/index.ts`
   directly and drift is impossible. If the UI is something else, say so and the backend
   can stay TS with the types published as JSON Schema.
2. **Persistence** — SQLite/Prisma vs. in-memory + JSON file. In-memory is faster to
   build and fine for a demo, but loses state on reload, which is bad if the demo is live.
3. **Auth** — assumed none. `userId` is a local-storage UUID.
4. **Demo city** — one city should be pre-warmed into the cache so the demo never
   waits on a cold Overpass/Exa call. Which city?
