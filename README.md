<div align="center">

<img src="images/image.png" width="96" alt="Waylo">

# Waylo

**You wander. Waylo figures out the rest.**

A travel companion that plans a trip for any city you name — then keeps re-planning it
while you are on it, as the weather, your budget and your behaviour change.

**Live → https://waylo-lemon.vercel.app**

</div>

---

## What it actually does

Type a sentence. *"Kyoto for 4 days, 90 dollars a day, temples, gardens and second-hand
books, relaxed pace."*

A model reads it, Nominatim resolves the city, Open-Meteo supplies the timezone, and the
planner builds days out of real OpenStreetMap places near that city — ranked against the
interests it read, shaped so meals land at mealtimes, and kept varied so a history lover
does not get five museums in a row.

Then the loop that makes it a companion rather than a planner:

| | |
|---|---|
| **Perceive** | weather, location, time, remaining budget, what you skipped |
| **Reason** | "does today still make sense?" — asked again, not once at booking |
| **Act** | re-orders the day, re-routes transport, and says exactly why |
| **Learn** | three rejected $50 dinners is a preference, not a coincidence |

Eight agents, each owning one concern and one colour that never changes:
**Atlas** orchestrates · **Nest** stays · **Morsel** food · **Muse** attractions ·
**Dash** transport · **Nimbus** weather · **Fixer** local essentials · **Echo** learns.

## What is real

Everything on screen is live or real data unless it says otherwise:

- **Places** — OpenStreetMap via Overpass, for whatever city you named
- **Weather** — Open-Meteo, hourly, with the rain windows that drive re-planning
- **Walking and driving distances** — OSRM road geometry, drawn on the map
- **Métro lines, stations and interchanges** — OpenStreetMap, seeded for Montreal
- **Photos** — Wikimedia Commons, credited at `/credits`

Modelled and labelled as such: fares, per-mode durations and taxi prices. There is no
GTFS feed, so nothing pretends to be a timetable. Outside Montreal the app says
*"no metro network mapped for this city yet"* rather than inventing a route.

## Running it

```bash
npm install
cp .env.example .env.local     # every key is optional
npm run dev                    # http://localhost:3000
```

It runs with **no keys at all** — places, weather and routing need none. Add
`OPENROUTER_API_KEY` for the prose and the in-app chat, and `EXA_API_KEY` for free-text
local search.

```bash
npm run typecheck              # must pass before any merge
npm run build
```

Set `NEXT_PUBLIC_RECORDING=1` in `.env.local` to hide the Next dev badge and the
CopilotKit watermark while screen recording.

## How it holds up when things break

This is the part worth reading:

- **Free models rate-limit and return their own scratchpad.** Every agent has a
  deterministic path, so a model failure costs you phrasing, never a wrong plan. A
  quality gate rejects a reply that looks like reasoning instead of an answer, and the
  chain falls through paid → free on 429, 402 and 5xx alike.
- **Upstreams degrade, visibly.** Explore labels its own provenance — `live`,
  `checking`, or `offline sample` with the reason. It never silently pretends.
- **Overpass 406s without a User-Agent**, 504s under load, and rejects a UA containing a
  placeholder contact address. All three cost us an afternoon; all three are handled.
- **Caching is on disk, under `/tmp` on Vercel** where the filesystem is read-only, and
  write failures are reported rather than swallowed — a dead cache costs real money.

## The shape of it

```
app/
  (app)/           the in-trip shell: today, now, itinerary, explore, budget, …
  api/             contract-shaped endpoints, live-backed with fixture fallbacks
components/        ImageSlot, MapFrame, PlaceGallery, shared primitives
lib/
  trips/           prompt parsing, trip store, itinerary generation
  providers/       Nominatim, Overpass, Open-Meteo, OSRM, Exa, Wikipedia
  agents/          ranking, the "what should I do now" agent
  llm/             OpenRouter client: failover, JSON repair, quality gate
  transit.ts       métro routing over the seeded network
types/             THE CONTRACT — index.ts, providers.ts, agents.ts
```

**`types/` is the contract and has a single owner.** Everything imports it; nobody edits
it without asking. See [`AGENTS.md`](AGENTS.md).

## Docs

[`docs/DEMO.md`](docs/DEMO.md) — the 2 minute walkthrough ·
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — every endpoint ·
[`AGENTS.md`](AGENTS.md) — team rules, branching, deploy ·
[`docs/BRAND.md`](docs/BRAND.md) — design tokens

## Team

| | Lane |
|---|---|
| **Ali** | UI |
| **Sara** | data & tools — [plan](docs/SARA_PLAN.md) · [prompts](docs/SARA_PROMPT.md) |
| **Paria** | agents — [plan](docs/PARIA_PLAN.md) · [prompts](docs/PARIA_PROMPT.md) |

Built at the AI Tinkerers *Agents, Everywhere* hackathon.
