# Waylo — demo script

**Live:** https://waylo-lemon.vercel.app · **Repo:** https://github.com/mehrshaad/Travel-Agent

Share the **alias** above, never a `waylo-<hash>.vercel.app` deployment URL — those sit
behind Vercel SSO and a judge would hit a login wall.

---

## Before you present

- Open the alias once, a few minutes early. The first request wakes the serverless
  functions and warms the Overpass/Open-Meteo caches; after that everything is fast.
- Click **Transit** on Today once during that warm-up. It costs the six routing calls
  up front so the tab is instant on stage.
- Allow location when `/now` asks. If you decline it still works — it falls back to the
  booked hotel and says so — but GPS is the better story.

---

## The four moments, in order

### 1 · It plans from what you say — `/`

Type into the prompt box, or take the "Three days in Toronto…" chip. Press **Plan my
days** → onboarding → **Dispatch the crew**.

> Eight named agents, each owning one concern. Watch them work down the list.

Generating runs ~5 seconds then lands on Today.

### 2 · It re-plans, and tells you why — `/today`

The black banner at the top: *Nimbus + Atlas · adapted 12 min ago*.

> Rain 3–5 PM, so Mount Royal moved to Thursday and Pointe-à-Callière took its slot —
> indoor, six minutes from lunch.

**Say the honest part:** this banner is scripted copy, but the same decision runs live —
`GET /api/trips/trip_montreal_demo/replan/live` checks the real forecast and returns a
proposal **or nothing**. Today it returns nothing, because Montreal's weather is
genuinely fine. A replanner that always finds something to change is broken, not smart.

### 3 · Every leg, three ways — `/today`, the Route card

Click **Walking → Transit → Taxi**. The totals change, the directions change, the map
line changes colour and the métro stations appear.

Point at the last leg:

> Librairie Bertrand → Damas · Métro · change · 44 min · $3.75
> Walk 493 m to Square-Victoria-OACI · Orange to Snowdon, 8 stops · change · Blue to
> Outremont, 4 stops · walk 166 m

Those are real stations and real interchanges. The four STM lines, their colours and
full station order came out of OpenStreetMap; routing enumerates every journey up to two
changes and picks the fastest. Short hops say **"Walk instead"** rather than inventing a
metro ride for 600 m.

Then drag a stop by its grip — the rows slide, and **the map route re-sequences to match**.

### 4 · It answers from where you actually are — `/now`

Click **✨ What should I do right now?** on Today, or the **Now** tab.

It asks the browser for real coordinates, then answers from the live forecast, what is
actually open nearby, and the budget you type in the box. Change the budget and ask
again — the answer changes.

> A minute's walk from something worth your time. It is 21°C and dry. Presse Cafe is
> 81 m away, about $7, which keeps you inside the $40 you have left today.

Real café, real distance, real temperature.

### 5 · The crew can change the trip — the chat bubble, bottom right

Open it and type:

```
Move the bookstore to position 2
```

It resolves "the bookstore" to Librairie Bertrand, calls the action, the plan reorders
and the map follows. Then try an ambiguous one:

```
move the cafe earlier
```

Two stops match, so it asks which — it does not guess.

---

## If something fails on stage

Nothing here is load-bearing on a single upstream, so say what you see:

| If | What actually happens | Say |
|---|---|---|
| Overpass is slow or down | Explore falls back to curated results and the badge reads *offline sample* with the reason | "It degrades and tells you it degraded." |
| The free LLM rate-limits | `/now` narrative falls back to deterministic text; `writtenBy` flips to `rules` | "The model writes the sentence. It never decides the plan." |
| The chat errors | Runtime retries down four free models before giving up | "Free tier. There's a failover chain behind it." |
| Location denied | Falls back to the booked hotel, labelled in the header | "That's the designed path, not a failure." |

---

## Questions you should expect

**"Is any of this real, or is it mocked?"**
Places, weather, walking distances, métro lines and stations are live or real data.
Fares, per-mode durations and taxi prices are modelled and say so in the response.
There is no GTFS feed, so nothing claims to be a timetable.

**"What does the LLM actually do?"**
Writes the narrative and drives the chat. Ranking, scheduling, routing and re-planning
are deterministic — which is why a rate limit costs you phrasing, not correctness.

**"What did it cost?"**
Nothing but Exa, and the meter shows spend. OpenStreetMap, Open-Meteo, OSRM, Wikipedia
and OpenRouter's free models carry the rest.
