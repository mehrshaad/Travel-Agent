# Work split

Rules live in [`AGENTS.md`](../AGENTS.md). This is who builds what, and in what order.

Lanes are assigned by **dependency position**, not by seniority. The ordering below is
the point: it is chosen so nobody ever waits on anybody.

Assign names to lanes before starting. Lane A is already taken (UI is in progress).

---

## Lanes

### Lane A — UI — Ali
**Owns** `app/(ui)/**` · `components/**` · `styles/**` · `hooks/**`

- Trip setup (natural-language prompt + structured confirm step)
- Itinerary board: days, time slots, drag/lock/skip
- Map with place pins + route polylines
- Recommendation cards — **must render `why.text`**, it is the product
- Agent activity panel (consumes `AgentTrace` from SSE)
- Replan banner with Accept / Keep-original
- ✨ "What should I do now?" card stack
- Budget bar + learned-profile panel with `changeLog`

**Builds entirely against `?mock=1`.** Zero dependency on any other lane at any point.

### Lane B — Data & tools — Sara · [plan](SARA_PLAN.md)
**Owns** `lib/providers/**` · `lib/cache/**`

Implements `ProviderRegistry` (interface published by Lead before this lane starts).

- `nominatim.ts` — geocode, 1 req/s limiter, cache by query
- `overpass.ts` — POI search by bbox + category, tile cache, `[timeout:25]`
- `openMeteo.ts` — forecast → `WeatherHour[]` + `badWindows` detection
- `osrm.ts` — walk/bike/car duration + distance + polyline
- `exa.ts` — free-text search, **hard budget guard**, per-call `costUsd`
- `wikipedia.ts` — landmark descriptions
- `normalize.ts` — every source → `Place`, incl. `interests`, `ambience`, `confidence`
- `cache/` — disk cache, TTL per provider; `UsageMeter`

**No LLM work in this lane.** Most deterministic, most testable, easiest to verify —
give it to whoever wants clear success criteria over prompt-wrangling.

**Highest-leverage single file: `normalize.ts`.** Ranking quality is capped by how well
OSM tags map to `interests` and `ambience`. `ambience` correctness *is* the weather
demo — mislabel a museum as outdoor and the hero moment breaks.

### Lane C — Agents — Paria · [plan](PARIA_PLAN.md)
**Owns** `lib/agents/**` · `lib/llm/**`

- `llm/client.ts` — OpenRouter, strict JSON, schema validation, **1 retry, then
  rule-based fallback**, model routing, token accounting
- `agents/weather.ts` — forecast → `BadWeatherWindow[]` + replan triggers
- `agents/attractions.ts`, `food.ts`, `local.ts` — query → ranked `Recommendation[]`
- `agents/transport.ts` — `TransportLeg` with all modes compared + `reason`
- `agents/personalizer.ts` — signals → `UserProfile`, ranking, **`Explanation` generation**
- `agents/orchestrator.ts` — parse NL prompt → `Trip`, fan out, collect

Consumes the provider interface, not provider implementations — so this lane starts
before Lane B finishes.

### Lead — contract, engine, integration
**Owns** `types/**` · `docs/**` · `app/api/**` · `lib/itinerary/**`

- `types/index.ts` + `API_CONTRACT.md` (done)
- **`types/providers.ts` + `types/agents.ts`** — unblocks B and C simultaneously
- `lib/mock/fixtures/**` — unblocks A immediately
- `lib/itinerary/schedule.ts` — places + hours + travel time + pace → day plan
- `lib/itinerary/replan.ts` — perceive → reason → diff → `ReplanEvent`
- `app/api/**` — all routes, SSE plumbing, `ApiResponse` envelope, `?mock=1`
- Integration, review, unblocking, demo seed cache

---

## Order of work

The only thing that matters: **the three unblocking artifacts ship before lane work starts.**

**Phase 0 — Lead, before anyone else starts**
1. Type contract ✅
2. `lib/providers/index.ts` — provider interface signatures
3. `lib/mock/fixtures/**` — one populated fixture per endpoint

After Phase 0, all three lanes run fully parallel with zero blocking.

**Phase 1 — parallel**

| A | B | C | Lead |
|---|---|---|---|
| Trip setup, itinerary board, cards | Nominatim, Overpass, normalize, cache | LLM client + validation + fallback | Schedule engine, API routes |

**Phase 2 — parallel**

| A | B | C | Lead |
|---|---|---|---|
| Map, agent panel, budget bar | Open-Meteo, OSRM, Exa + budget guard | Weather, attractions, food, transport agents | SSE, replan engine |

**Phase 3 — first integration. Flip `?mock=1` off.**
Everything that was going to be wrong shows up here. Budget real time for it — this is
where "it worked on my branch" goes to die. Lead drives; lanes fix in their own files.

**Phase 4 — the demo**

| A | B | C | Lead |
|---|---|---|---|
| Polish, loading/empty/error states | Seed demo-city cache | Personalizer tuning, explanation quality | Demo script, end-to-end rehearsal |

**Feature freeze: 4 hours before deadline.** Bugfixes and rehearsal only.

---

## The demo is the deliverable

The judged moment is not "it generated an itinerary." It is:

1. Natural-language prompt → itinerary builds with **agents visibly working**
2. Weather turns → **replan banner proposes a swap with a reason** → accept → itinerary changes
3. Reject three expensive restaurants → **profile visibly updates** → recommendations change
4. ✨ "What should I do now?" → context-aware answer citing time, weather, budget

Every lane owns one of these end to end. If a feature does not serve one of the four,
it is cut — not deferred, cut.

**Pre-seed the demo city's cache and rehearse on it.** A live cold Overpass call in
front of judges is an avoidable way to lose.

---

## Open

1. **Demo city?** Needs pre-warmed cache. Doc examples use Montreal/Toronto.
2. **Deadline?** Phases above are relative; converting them to clock times needs it.
3. **Sara/Paria lane swap?** Lane B is deterministic API work, Lane C is prompt work. Swap if their preferences run the other way.
4. **Persistence** — in-memory is faster to build but loses state on reload. If the demo
   is live, that argues SQLite.
