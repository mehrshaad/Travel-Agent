# Paria — prompts for Codex

How to use this file:

1. Paste **§1 Session prompt** at the start of every new Codex session.
2. Then paste **one task prompt** from §2. One task per session, or at minimum one task
   per message. Never paste two.
3. Before opening a PR, paste **§3 Self-review prompt**.

> **Why one task at a time:** given a whole plan, coding agents start "helpfully"
> refactoring files they weren't asked about. That's what creates merge conflicts with
> Sara and Ali. A bounded task is the single biggest lever you have on output quality.

---

## §1 Session prompt — paste first, every session

```
You are working on Waylo, a multi-agent travel companion app, as part of a
three-person team. Each person owns a strict slice of the repo.

I am Paria. I own Lane C: `lib/agents/**` and `lib/llm/**`. ONLY those.

Before doing anything, read these files in the repo:
- AGENTS.md           — the team's rules. They are binding.
- docs/PARIA_PLAN.md  — my full task list, with design decisions and gotchas.
- types/index.ts      — the shared data contract.
- types/agents.ts     — the interfaces I implement.
- types/providers.ts  — the provider interfaces I consume (but never implement).

Hard rules for this session:
1. NEVER edit anything under `types/`. If a type or interface seems wrong, STOP and
   tell me — I will ask the lead. Do not work around it and do not define a local
   duplicate type.
2. NEVER edit `lib/providers/`, `lib/cache/`, `app/`, or `components/`. Those belong to
   teammates. If something there is broken, tell me; do not fix it.
3. NEVER import from `lib/providers/`. Data access goes through `ctx.providers`, which
   is typed by `types/providers.ts`. This is what lets me work before my teammate's
   implementations exist.
4. NEVER add a dependency without asking me first. `zod` is already available.
5. No refactoring, renaming, or reformatting of code you were not asked to change.
   Every changed line must trace to the task I give you.
6. Never regenerate a whole file. Make surgical edits.
7. No speculative abstraction. This is a hackathon codebase; minimum correct code wins.
8. Never commit an API key. Secrets live in `.env.local`, which is gitignored.
9. Never add AI attribution to commits (no "Co-Authored-By", no "Generated with").

THE MOST IMPORTANT CONSTRAINT IN THIS LANE:
We run on free-tier LLMs. They rate-limit, they are slow (10-40s), and they return
JSON wrapped in prose, fenced in markdown, or truncated. This is normal operation, not
an error case.

Therefore: every agent must produce a CORRECT answer with the LLM completely removed.
Build the deterministic rule-based path FIRST, then let the LLM improve the wording or
the ranking on top of it. The LLM must never be load-bearing for correctness. If a
model rate-limits during our demo, the app must degrade to slightly more generic text,
never to a blank screen or a thrown error.

Acknowledge by listing the files you are allowed to edit, and confirm you understand
the LLM-optional rule. Then wait for my task. Do not start writing code yet.
```

---

## §2 Task prompts — paste one at a time

### C0 — fake providers (do this first, it unblocks everything)

```
Before any real task: create `lib/agents/__fixtures__/fakeProviders.ts`.

Export a function returning an object satisfying the `ProviderRegistry` interface from
types/providers.ts, backed by 3-4 hardcoded Place objects and one hardcoded
WeatherForecast. No network calls at all.

Make the fixtures realistic in the ways that matter:
- At least one Place with `rating: undefined` and `priceLevel: undefined` — that is the
  common case for OpenStreetMap data and my code must handle it.
- At least one Place with `openingHours: { weekly: [], unknown: true }`.
- A mix of `ambience: "indoor"` and `"outdoor"`.
- A forecast containing an afternoon rain window.

Keep it under about 120 lines. This exists so I can develop and test without waiting on
my teammate's provider implementations.

Do not touch any other file.
```

### C1 — LLM client

```
Task C1 from docs/PARIA_PLAN.md: implement `lib/llm/client.ts`, `lib/llm/extract.ts`,
and `lib/llm/models.ts`.

Implement the `LlmClient` interface from types/agents.ts. Endpoint, headers, and the
model routing table are in the plan. Key comes from OPENROUTER_API_KEY in .env.local.

`complete<T>()` must follow exactly this pipeline:
1. Call the model.
2. `extractJson(raw)`, trying in order: direct JSON.parse; strip ```json fences; first
   balanced {...} or [...] found by brace counting; repair trailing commas and smart
   quotes.
3. Validate with the provided zod schema.
4. On failure, retry ONCE, appending the validation error to the prompt and demanding
   JSON only.
5. If it still fails, call the caller's `fallback()` and return it with `fellBack: true`.

`complete()` MUST NEVER THROW. Not on HTTP 429, not on timeout, not on unparseable
output. Every exit path returns a valid LlmResult.

Do NOT rely on `response_format: { type: "json_schema" }`. Support is inconsistent
across free models, and a model that ignores it returns prose my parser must handle
anyway. Put the schema in the prompt AND validate the result.

Also cap concurrent in-flight LLM calls at 2-3. Fanning out six agents at once on a
free tier gets all of them rate-limited simultaneously.

Then write `scripts/test-llm.ts` proving that a prompt which deliberately returns prose
still yields a valid typed object through the fallback path, with nothing thrown.

Do not touch any other file.
```

### C2 — schemas

```
Task C2 from docs/PARIA_PLAN.md: implement `lib/llm/schemas.ts` and
`lib/llm/prompts.ts`.

One zod schema per structured LLM output. Keep every schema SMALL and FLAT — nested
objects are where free models fail hardest.

Follow this rule strictly: never ask the model to echo back data we already have.
Send candidates as short ids, ask for ids plus scores plus a one-line reason, then
rehydrate from our own objects on our side. This cuts token usage roughly tenfold,
removes hallucinated fields entirely, and makes validation trivial.

Each system prompt should state the output schema inline and instruct the model to
reply with JSON only, no prose and no code fences.

Do not touch any other file.
```

### C3 — weather agent

```
Task C3 from docs/PARIA_PLAN.md: implement `lib/agents/weather.ts` as the
`WeatherAgent` interface from types/agents.ts.

The provider already computes `badWindows`. My job here is the DECISION layer:
- Produce per-day `advisories` naming the exact time window.
- Decide which badWindows are worth a replan: it must overlap a weather-sensitive
  itinerary item, last at least 2 hours, and be at least moderate severity.

This should be almost entirely rule-based. Use the LLM only to phrase the advisory
nicely, with a template fallback like:
`Rain likely ${from}-${to}. Indoor options suggested.`

Verify it works with the LLM disabled, using the fake providers from C0.

Do not touch any other file.
```

### C4 — discovery agents

```
Task C4 from docs/PARIA_PLAN.md: implement `lib/agents/attractions.ts`,
`lib/agents/food.ts`, and `lib/agents/local.ts`. All three implement `DiscoveryAgent`.

Shared flow:
1. If `q.query` is present, use `ctx.providers.text.searchText()` — but call
   `canSpend()` FIRST and fall back to `searchPlaces()` when it returns false. That
   provider is metered and the budget is small.
2. Otherwise use `ctx.providers.places.searchPlaces()` with this agent's categories.
3. Filter by opening hours at `q.at`, dietary tags, and budget.
4. Rank via the personalizer.
5. Return the top N, each with a populated `why`.

TWO CRITICAL DATA FACTS about our OpenStreetMap-sourced places:
- `rating` and `priceLevel` are `undefined` for nearly every place. Treat a missing
  rating as NEUTRAL, never as zero. Scoring it as zero silently deletes every real
  result and produces an empty list that is very hard to debug.
- `openingHours.unknown === true` is common. Treat unknown hours as KEEP, not as
  closed. Dropping unknowns removes most of the dataset.

Category sets are listed in the plan. Use the fake providers from C0 to verify.

Do not touch any other file.
```

### C5 — transport agent

```
Task C5 from docs/PARIA_PLAN.md: implement `lib/agents/transport.ts` as
`TransportAgent`.

`ctx.providers.routing.routeAll()` returns options with no `recommended` set. I choose
the winner. The selection rules are in the plan — implement them as plain rules, no LLM.

Write `reason` as one honest human sentence, for example:
"18 min walk in clear weather, and you prefer walking."

Note: our routing provider deliberately computes per-mode durations from distance and
speed constants rather than from the routing engine, because the public OSRM demo
server returns car speeds for every profile. Those numbers are intentional. Do not
"correct" them, and do not add your own duration logic on top.

Verify with the fake providers: a 500m hop should pick walking; a 6km hop in rain
should not.

Do not touch any other file.
```

### C6 — personalizer (the differentiator)

```
Task C6 from docs/PARIA_PLAN.md: implement `lib/agents/personalizer.ts` as
`PersonalizerAgent`.

This agent is deliberately ARITHMETIC, not LLM-driven, so that our learning demo is
reproducible on stage. Do not introduce an LLM into `update()` or `rank()`.

`update(profile, signals)`: apply the signal weights and decay listed in the plan,
clamp to [0,1], and update budgetBand, preferredPriceLevels, maxWalkMeters, minRating,
and confidence per the formulas there.

MOST IMPORTANT REQUIREMENT: every change must append a `ProfileChange` to `changeLog`
with a human-readable `cause`, for example "3 consecutive rejections of $$$
restaurants". The UI renders this as the visible proof that the system learned
something. A profile that silently changes numbers is indistinguishable from a random
number generator to someone watching a demo. Do not skip this field.

`rank(places, ctx)`: the weighted sum in the plan. When rating is unknown, use a
neutral 0.6, never 0.

`explain(place, ctx)`: build `factors[]` directly from the scoring terms — those
numbers are already computed, so this is always correct and needs no model. Then
OPTIONALLY use the fast model to turn the factors into one natural sentence, falling
back to a template.

Include negative factors honestly, such as "A bit above your usual price range" with a
negative weight. The type supports negative weights for exactly this reason, and
showing the caveat builds more trust than hiding it.

Verify with the LLM disabled: rejecting three expensive restaurants must visibly lower
preferredPriceLevels AND write a readable changeLog entry.

Do not touch any other file.
```

### C7 — orchestrator

```
Task C7 from docs/PARIA_PLAN.md: implement `lib/agents/orchestrator.ts` as
`OrchestratorAgent`. Four methods.

`parseTrip()`: natural language to a structured Trip, using the `extract` model with a
flat schema. Resolve relative dates like "next Friday" against today, in the
destination's timezone. Anything the model did not find gets a default AND is listed in
`assumed[]` so the UI can ask the user to confirm.
This method MUST NEVER FAIL. Fallback: regex for dates and "$N" amounts, and take the
longest capitalized span as the destination. A bad parse becomes a confirmation step in
the UI; a thrown error becomes a dead landing page, and this is the first thing a judge
will touch.

`gather()`: fan out the discovery agents per section, with concurrency capped at 3.
Return candidates only — scheduling belongs to the lead, do not build an itinerary here.

`evaluate()`: the core agentic loop. Perceive weather windows, budget status, location
and time; reason about which planned items are now wrong; emit a ReplanEvent.
- NEVER move or remove an item with `locked === true`. If a fix would require touching
  a locked item, return `changes: []` with a `decision` explaining why. Silently moving
  a pinned item destroys user trust immediately.
- `observation` and `decision` are shown to the user. Write them like a person would:
  observation "Heavy rain 14:00-17:00 on Sep 16", decision "Moved Mount Royal to Sep 17
  morning, Fine Arts Museum in its place".
- Return null when the plan is still fine. A replanner that always finds something to
  change reads as broken rather than smart. Restraint is a feature here.

`now()`: gather current time, location, next scheduled item, current weather hour,
remaining daily budget, and profile. Get 1-3 candidates from the discovery agents, then
use `llm.prose()` for the narrative with a template fallback. The narrative should cite
concrete facts — the time available, the temperature, the remaining budget — because
that is what makes it read as a companion rather than a search box.

Verify all four against the fake providers with the LLM disabled.

Do not touch any other file.
```

---

## §3 Self-review prompt — before every PR

```
Review the diff you just produced, as a reviewer rather than the author.

Check each of these and report honestly:
1. Does every changed line trace to the task I gave you? List any that do not.
2. Did you edit any file outside `lib/agents/` and `lib/llm/`?
3. Did you import anything from `lib/providers/` directly instead of using
   `ctx.providers`?
4. Would every agent still return a valid, correct result if the LLM were removed
   entirely? Name any place where the LLM is load-bearing for correctness.
5. Can `complete()` throw on any path — 429, timeout, or unparseable output?
6. Does every Recommendation carry a non-empty `why.text` and at least two factors?
7. Is any secret, key, or token present in the diff?
8. Does `npm run typecheck` pass, with no `any` and no type assertions hiding a real
   mismatch?

If you find violations, fix them. Do not add new features while reviewing.
```

## §4 When you're stuck

```
I am blocked on: <describe>.

Do not guess and do not work around it. Tell me:
1. What exactly is failing, with the error text.
2. Whether it is my code, the model provider (rate limit, model unavailable), or a
   wrong assumption in docs/PARIA_PLAN.md.
3. The smallest experiment that would distinguish them.

If the blocker is a rate limit or a model returning consistently bad output, say so
explicitly — swapping the model id in `lib/llm/models.ts` may be a one-line fix.

If the blocker is a type or interface in `types/`, say so explicitly — that needs the
lead to change, not us.
```

> Team rule: blocked more than 20 minutes → message the team. Grinding alone is the
> most expensive thing you can do in a hackathon.
