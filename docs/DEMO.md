# Waylo — 2 minute walkthrough

**https://waylo-lemon.vercel.app**

Share that link, never a `waylo-<hash>` one — those sit behind Vercel login.

**Before you start:** open `/today` once and click **Transit**. That warms the caches so
nothing spins on stage. Allow location when `/now` asks.

---

## 0:00 — The hook *(15s)*

Open the landing page.

> "Most travel AI writes you an itinerary once, and then you're on your own.
> Waylo keeps re-planning the trip **while you're on it**."

Click **Open demo trip**.

---

## 0:15 — It already changed your day *(30s)*

You land on Today. Point at the black banner.

> "Rain at 3 PM. So Nimbus moved Mount Royal to Thursday and dropped the archaeology
> museum into that slot — indoors, six minutes from lunch. Dash re-routed the walk.
> **Every change comes with the reason.**"

Click **Keep it**. It confirms.

---

## 0:45 — Three ways to make the same trip *(30s)*

In the Route card, click **Walking → Transit → Taxi**. Totals change, the map line
changes colour, métro stations appear.

Point at the last leg:

> "Orange line to Snowdon, change to Blue, out at Outremont. **Those are real stations** —
> the whole métro network came out of OpenStreetMap. And look here —"

Point at a short leg reading **WALK INSTEAD**.

> "— it refuses to put you on a train for 600 metres."

Now drag a stop by its grip.

> "Reorder the day, and the route on the map follows."

---

## 1:15 — What should I do *right now* *(30s)*

Click the **✨ What should I do right now?** button.

> "This asks my browser where I actually am, checks the live forecast, and looks at
> what's open near me and what's left in today's budget."

Read the answer aloud — it will name a real café, a real distance, the real temperature.

Change the budget number, ask again.

> "Different budget, different answer."

---

## 1:45 — The crew can change the trip *(15s)*

Open the chat bubble, bottom right. Type:

```
Move the bookstore to position 2
```

The plan reorders and the map follows.

> "It didn't describe what to do. **It did it.**"

---

## Close

> "Eight agents, live weather, live places, real transit. Built on free tiers —
> OpenStreetMap, Open-Meteo, OSRM, and free models. The only thing we pay for is search,
> and the app shows you the meter."

---

## If something stalls

Say what you see — none of it is fatal:

- **Explore looks stale** → the badge says *offline sample*; it fell back and told you.
- **The crew is slow** → free models. There's a four-model failover behind it.
- **Location denied** → it uses your booked hotel instead, and says so.

## Two questions you'll get

**"Is this real or mocked?"**
Places, weather, walking distances, métro lines and stations are live. Fares and
per-mode durations are modelled and labelled as such — there's no GTFS feed, so nothing
pretends to be a timetable.

**"What does the LLM actually do?"**
Writes the prose and runs the chat. Ranking, routing and re-planning are deterministic —
so a rate limit costs you phrasing, never correctness.
