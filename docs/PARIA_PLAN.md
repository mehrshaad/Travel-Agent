# Paria — Lane C: Agents & LLM

**You own:** `lib/agents/**` and `lib/llm/**`. Nothing else.
**Read first:** [`AGENTS.md`](../AGENTS.md) — especially §1 (never edit `types/`) and §3.

Your job: the reasoning layer. This lane is what makes the project *agentic* instead of
"several API wrappers in a trench coat" — it's the thing judges are actually scoring.

You are unblocked right now. You code against **interfaces**, not against Sara's files,
so you never wait for her.

---

## Your contract

```ts
import type { AgentContext, LlmClient, OrchestratorAgent } from "@/types/agents";
import type { ProviderRegistry } from "@/types/providers";
```

Everything you need arrives in `AgentContext`. **Never import from `lib/providers/`
directly** — take `ctx.providers`. That's what lets you run before Sara ships, and it's
what lets you test with a 20-line fake registry.

You do not edit `types/`. Wrong signature → message Ali.

---

## Setup

```bash
git checkout -b lane-c/c0-fake-providers
npm install
cp .env.example .env.local   # fill OPENROUTER_API_KEY
npm run typecheck
```

Write a fake `ProviderRegistry` in `lib/agents/__fixtures__/fakeProviders.ts` returning
3–4 hardcoded `Place`s. **Do this first.** It's 20 lines and it means you never block on
Lane B, ever.

---

## The single most important thing in this lane

> **Free models return malformed JSON and rate-limit. That is normal operation, not an
> error case.**

Verified: 22 free models on OpenRouter, tool-capable ones include
`nvidia/nemotron-3-ultra-550b-a55b:free` (1M ctx) and `google/gemma-4-31b-it:free`.
Free tier means aggressive rate limits, 10–40s latency, and JSON wrapped in prose,
fenced in markdown, or truncated mid-object.

So: **every agent must produce a correct answer with the LLM completely removed.**

The LLM adds *quality* — better ranking, nicer explanations. It must never be load-bearing
for *correctness*. If a model 429s during the demo and a card renders blank, that's the
whole project. If it 429s and the card shows a slightly more generic explanation, nobody
notices.

Build the rule-based path **first**, then let the LLM improve on it. Not the reverse.

---

## Files you will create

```
lib/llm/
  client.ts        LlmClient — OpenRouter, validation, retry, fallback
  models.ts        "reasoning" | "fast" | "extract" -> model ids, w/ failover
  extract.ts       pull JSON out of whatever the model actually said
  schemas.ts       zod schemas for every structured output
  prompts.ts       system prompts, one per agent
lib/agents/
  weather.ts       WeatherAgent
  attractions.ts   DiscoveryAgent
  food.ts          DiscoveryAgent
  local.ts         DiscoveryAgent
  transport.ts     TransportAgent
  personalizer.ts  PersonalizerAgent   ← mostly NOT an LLM, see C6
  orchestrator.ts  OrchestratorAgent
  __fixtures__/    fake providers for local testing
```

---

## Task order

### C1 — `llm/client.ts`, `extract.ts`, `models.ts`

Everything else depends on this. Build it properly, it's ~150 lines.

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer <OPENROUTER_API_KEY>
  HTTP-Referer: http://localhost:3000
  X-Title: Waylo
Body: { model, messages: [...], temperature, max_tokens }
```

`complete<T>()` pipeline — this exact order:

1. Call the model
2. `extractJson(raw)` — try in sequence:
   - direct `JSON.parse`
   - strip ```` ```json ```` fences
   - first balanced `{…}` or `[…]` by brace counting
   - trailing-comma and smart-quote repair
3. Validate with the zod schema
4. On failure → **retry once**, appending the validation error to the prompt:
   `"Your previous reply was invalid: <error>. Reply with ONLY valid JSON matching the schema."`
5. Still failing → call `fallback()`, return `fellBack: true`

> ⚠️ **Do not rely on `response_format: { type: "json_schema" }`.** Support is
> inconsistent across free models and a model that ignores it returns prose that your
> parser must handle anyway. Put the schema in the prompt *and* validate. Treat any
> native structured-output support as a bonus, never as the mechanism.

**`complete()` must never throw.** Not on 429, not on timeout, not on garbage. Every
exit path returns a valid `LlmResult<T>`. Log the failure, set `fellBack`, move on.

`models.ts` — logical → concrete, with a failover chain per role (a free model going
down mid-hackathon is routine):

| role | primary | use |
|---|---|---|
| `reasoning` | `nvidia/nemotron-3-ultra-550b-a55b:free` | orchestrator, replan |
| `fast` | `nvidia/nemotron-3.5-lightning:free` | now-suggestions, explanations |
| `extract` | `google/gemma-4-31b-it:free` | prompt parsing, tagging |
| fallback | `openrouter/free` | when a specific model 404s or 429s |

Also: **cap concurrency at 2–3 in-flight LLM calls.** Fanning out six agents at once on
a free tier is the fastest way to get every one of them rate-limited simultaneously.

✅ **Done when:** a prompt that deliberately returns prose still yields a valid typed
object via fallback, and nothing throws.

### C2 — `llm/schemas.ts`

One zod schema per structured output. Keep them **small and flat** — nested objects are
where free models fail hardest. Ask for `{ "ids": ["osm:node/1", ...] }`, not a full
re-serialization of every `Place`.

> 🔑 **Never ask a model to echo back data you already have.** Send it candidates with
> short ids, ask for ids + scores + one-line reasons, then rehydrate from your own
> objects. This cuts tokens ~10×, removes hallucinated fields entirely, and makes
> validation trivial. This single decision will save you most of your debugging time.

### C3 — `agents/weather.ts`

Smallest agent, and it drives the hero demo moment. Do it early.

Sara's provider already computes `badWindows`. Your job is the *decision*:

- `advisories[]` — per day, e.g. `"Keep Sep 16 14:00–17:00 indoors; rain 80%."`
- Flag which `badWindows` are worth a replan: overlaps a `weatherSensitive` item,
  ≥2 hours, severity ≥ moderate

**Mostly rules, not LLM.** Use the LLM only to phrase the advisory nicely, with a
template fallback: `` `Rain likely ${from}–${to}. Indoor options suggested.` ``

✅ **Done when:** a forecast with afternoon rain produces an advisory naming the exact
window, with the LLM disabled.

### C4 — `agents/attractions.ts`, `food.ts`, `local.ts`

All three implement `DiscoveryAgent`. Same skeleton, different categories and prompt.

```ts
async discover(q: DiscoveryQuery, ctx: AgentContext): Promise<Recommendation[]>
```

1. `q.query` present → `ctx.providers.text.searchText()` (Exa), **but check
   `canSpend()` first** and fall back to Overpass when false
2. Otherwise → `ctx.providers.places.searchPlaces()` with this agent's categories
3. Filter: open at `q.at` (**treat `hours.unknown === true` as "keep it"**, not "drop it"
   — dropping unknowns deletes most of OSM), dietary tags, budget
4. Rank via `personalizer.rank()`
5. Return top N, each with a populated `why`

> ⚠️ **OSM returns no ratings.** `place.rating` is `undefined` for nearly everything
> Sara's Overpass provider yields. Treat missing rating as **neutral**, never as zero —
> scoring it as 0 silently deletes every real result and you'll spend an hour hunting
> an empty list. Same for `priceLevel`.

Category sets: attractions → museum, gallery, landmark, historic, park, viewpoint;
food → restaurant, cafe, bakery, bar; local → pharmacy, grocery, atm, laundry,
restroom, luggage_storage, convenience.

✅ **Done when:** each returns ranked `Recommendation[]` with non-empty `why.text`
against the fake registry, LLM off.

### C5 — `agents/transport.ts`

`ctx.providers.routing.routeAll()` gives you options without a `recommended`. You pick.

Pure rules, no LLM:

```
walk      if distance <= maxWalkMeters and weather is outdoorFriendly
transit   if walk is too far and transit exists
bike      if user weights bike high and distance < 5 km
rideshare if duration saved > 15 min AND it fits remaining budget
```

Write `reason` as one honest sentence: `"18 min walk in clear weather, and you prefer walking."`

> Sara's plan documents this: **OSRM's public demo ignores the profile and returns car
> speeds for every mode.** She computes per-mode durations from distance instead. Don't
> "fix" apparent inconsistencies in her numbers — they're deliberate. Ask her.

✅ **Done when:** a 500 m hop picks `walk`, a 6 km hop in rain doesn't.

### C6 — `agents/personalizer.ts` ← the differentiator

**This is mostly arithmetic, not an LLM.** Deterministic means demoable and debuggable.
An LLM here would make learning non-reproducible on stage.

`update(profile, signals)`:

```
saved     +0.15 to each of the place's interests
clicked   +0.05
dwell>10s +0.05
visited   +0.20
rejected  −0.20
booked    +0.25
```

Clamp `[0, 1]`. Decay all weights ×0.98 per update so early noise fades.

- `budgetBand` / `preferredPriceLevels` ← rolling mean of accepted vs rejected price levels
- `maxWalkMeters` ← 80th percentile of accepted walking legs
- `minRating` ← mean rating of saved places, minus 0.3
- `confidence` = `min(1, signalCount / 25)`

> 🔑 **Every change must push a `ProfileChange` into `changeLog` with a human `cause`:**
> `"3 consecutive rejections of $$$ restaurants"`. The UI renders this as the Learning
> panel — **it is the visible proof that learning happened.** A profile that silently
> changes numbers is indistinguishable from a random number generator to a judge. This
> field is the entire demo moment #3. Do not skip it.

`rank(places, ctx)` — weighted sum, all deterministic:

```
0.30 interest match     0.20 rating (neutral 0.6 when unknown)
0.20 budget fit         0.15 distance
0.10 novelty            0.05 weather fit
```

`explain(place, ctx)` — build `factors[]` from the scoring terms (you already have the
numbers — that's your template fallback, and it's always correct). Then optionally ask
the `fast` model to turn those factors into one natural sentence.

> **Include negative factors.** `"A bit above your usual price range"` with
> `weight: -0.2` builds more trust than hiding it, and it's the kind of honesty judges
> notice. The type supports negative weights for exactly this.

✅ **Done when:** rejecting three expensive restaurants visibly lowers
`preferredPriceLevels` **and** writes a readable `changeLog` entry — LLM off.

### C7 — `agents/orchestrator.ts`

Four methods.

**`parseTrip()`** — NL → structured. The `extract` model with a flat schema:
`{ destination, startDate, endDate, dailyBudget, currency, interests[], pace, dietary[] }`

- Resolve relative dates ("next Friday", "three days") against today, in the destination's timezone
- Anything the model didn't find → default, and list it in `assumed[]` so the UI asks
- Fallback: regex for dates and `$N`, destination = the longest capitalized span

> **Never fail this call.** A bad parse becomes a confirm step in the UI; a thrown error
> becomes a dead landing page. This is the first thing a judge touches.

**`gather()`** — fan out discovery agents per section. **Concurrency ≤3.** Return
candidates only; scheduling is Ali's.

**`evaluate()`** — the agentic loop, and demo moment #2:

```
perceive  weather badWindows, budget status, live location, time, closures
reason    which planned items are now wrong, and what replaces them
act       emit a ReplanEvent with changes[]
```

- **Never touch `item.locked === true`.** If a fix needs a locked item, return
  `changes: []` with a `decision` explaining why. Silently moving a pinned item destroys
  trust instantly.
- `observation` and `decision` are user-facing strings — write them like a person:
  `observation: "Heavy rain 14:00–17:00 on Sep 16"`,
  `decision: "Moved Mount Royal to Sep 17 morning, Fine Arts Museum in its place"`
- Return `null` when the plan is still fine. **A replanner that always finds something
  to change reads as broken, not smart.** Restraint is a feature.

**`now()`** — demo moment #4. Gather: current time, location, next item, current weather
hour, remaining daily budget, profile. Get 1–3 candidates from the discovery agents, then
`llm.prose()` for the narrative with a template fallback.

`headline` = the one-liner (`"You have 3 hours before dinner."`). `narrative` should cite
concrete facts — time, temperature, budget — because that's what makes it read as a
companion rather than a search box.

✅ **Done when:** all four work against the fake registry with the LLM disabled.

---

## Definition of done (all of it)

- [ ] `npm run typecheck` clean
- [ ] **Every agent works with the LLM disabled** — set a `DISABLE_LLM=1` env and verify
- [ ] `complete()` never throws: 429, timeout, and garbage JSON all tested
- [ ] Every `Recommendation` has a non-empty `why.text` and ≥2 `factors`
- [ ] `changeLog` populated on every profile change
- [ ] Locked items never moved by `evaluate()`
- [ ] LLM concurrency capped, verified
- [ ] No API key in any committed file

## Rules that will bite you

- **Never edit `types/`.** Wrong signature → message Ali.
- **Never edit `lib/providers/` or `lib/cache/`** — those are Sara's.
- **Never import from `lib/providers/`** — use `ctx.providers`.
- **One branch per task**, not one per lane — `lane-c/<task>`. Merge it as soon as
  the task is done. A branch open longer than a day is too big; split it. See `AGENTS.md` §6.
- Rebase twice a day: `git pull --rebase origin main`
- Commit style: `feat(c): add personalizer signal folding with changeLog`
- No AI attribution in commits.
- **Blocked >20 min → say so.** Especially on rate limits — there may be a model swap
  that fixes it in one line.
