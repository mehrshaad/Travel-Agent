<div align="center">

<img src="images/image.png" width="96" alt="Waylo">

# Waylo

**You wander. Waylo figures out the rest.**

A travel companion that does not just plan a trip — it keeps re-planning one while you are on it,
as the weather, your budget and your behaviour change.

</div>

---

## The idea

Most travel AI generates an itinerary once and hands it over. Waylo runs a loop instead:

| | |
|---|---|
| **Perceive** | weather, location, time, remaining budget, what you skipped |
| **Reason** | "does today still make sense?" — asked hourly, not once at booking |
| **Act** | re-orders the day, re-routes transport, and says exactly why it changed |
| **Learn** | three rejected $50 dinners is a preference, not a coincidence |

Eight agents, each owning one concern and one colour that stays consistent across the whole product:

| Agent | Role | | Agent | Role |
|---|---|---|---|---|
| **Atlas** | orchestrator | | **Dash** | transport |
| **Nest** | stay | | **Nimbus** | weather |
| **Morsel** | food | | **Fixer** | local essentials |
| **Muse** | attractions | | **Echo** | personalization |

## Running it

```bash
npm install
cp .env.example .env.local     # fill in keys; .env.local is gitignored
npm run dev                    # http://localhost:3000
```

The UI runs entirely on fixtures, so it works with no API keys at all.

```bash
npm run typecheck              # must pass before any merge
npm run build
```

## What is here

```
app/                 Next.js App Router — 16 screens + 15 API routes
  (app)/             the in-trip shell: today, itinerary, explore, budget, …
  api/               contract-shaped endpoints, fixture-backed
components/          ImageSlot, MapFrame, shared primitives
lib/
  mock/ui.ts         screen copy, as the design writes it
  mock/fixtures.ts   contract-shaped payloads for ?mock=1
  providers/         data providers — Nominatim, Overpass, Open-Meteo, OSRM, Exa
  agents/            the agent crew + LLM client
types/               THE CONTRACT — index.ts, providers.ts, agents.ts
public/montreal-map.html   Leaflet map, real coordinates for all four days
```

**`types/` is the contract and has a single owner.** Everything imports it; nobody edits it
without asking. See [`AGENTS.md`](AGENTS.md).

## API

Every endpoint returns `ApiResponse<T>` — `{ ok, data | error, meta }` — and today answers from
fixtures, so the whole surface works before any provider exists.

```bash
curl localhost:3000/api/trips/trip_montreal_demo/itinerary
curl -N -X POST localhost:3000/api/trips/trip_montreal_demo/replan   # SSE
```

Planning and replanning are **Server-Sent Events**, not request/response: free-tier models take
10–40s per agent, so days stream in one at a time. Full shapes in
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Built on free tiers

Everything except Exa costs nothing: **OpenStreetMap** (Nominatim + Overpass), **Open-Meteo**,
**OSRM**, **Wikipedia**, and **OpenRouter**'s free models. **Exa** ($0.007/search) is reserved for
the thing the free sources cannot do — genuine local knowledge — and is cached and hard-capped.

Two constraints this shapes, both visible in the code:

- **Free models return malformed JSON and rate-limit.** Every agent has a rule-based fallback and
  must be correct with the LLM switched off entirely.
- **OSM has no ratings and often no opening hours.** Missing data stays `undefined`; the UI renders
  "hours unknown", never "closed", and ranking treats a missing rating as neutral, never zero.

## Team

| | Lane | Plan |
|---|---|---|
| **Ali** | UI | — |
| **Sara** | data & tools — `lib/providers`, `lib/cache` | [plan](docs/SARA_PLAN.md) · [prompts](docs/SARA_PROMPT.md) |
| **Paria** | agents — `lib/agents`, `lib/llm` | [plan](docs/PARIA_PLAN.md) · [prompts](docs/PARIA_PROMPT.md) |

Rules, branching and deploy: [`AGENTS.md`](AGENTS.md) · Work split: [`docs/WORK_SPLIT.md`](docs/WORK_SPLIT.md) ·
Design tokens: [`docs/BRAND.md`](docs/BRAND.md)
