# Waylo — the 2 minute run

**https://waylo-lemon.vercel.app**

Two things before you hit record: open `/today` and click **Transit** once so the caches
are warm, and say yes when the browser asks for your location. Locally, set
`NEXT_PUBLIC_RECORDING=1` in `.env.local` — it hides the Next dev badge and the
CopilotKit watermark so the recording is just the product.

---

### The hook — 15 seconds

Landing page. Don't read the screen, just say it:

> "Every travel app plans your trip before you leave. Then you land, it rains, and
> you're on your own with a PDF.
>
> Waylo stays with you."

Click **Open demo trip**.

---

### It already fixed today — 30 seconds

You're on Today. The black bar is the whole pitch, so let it breathe for a second.

> "So I haven't touched anything yet — and it's already moved something.
>
> Rain at three. Mount Royal was outdoors at two, so Nimbus pushed it to Thursday and
> pulled the archaeology museum into that slot. Indoors, six minutes from where I'm
> eating lunch.
>
> And it tells me *why*. That's the part I care about."

Click **Keep it**.

---

### Now argue with it — 30 seconds

Hit **Walking**, then **Transit**, then **Taxi**. Let the numbers move.

> "Same day, three ways. Four and a half hours on foot, two and a half by métro, and
> about fifty bucks if I'm lazy."

Land on Transit. Point at the Damas leg.

> "Orange line to Snowdon, change to Blue, off at Outremont — that's a real route. We
> pulled the whole métro network out of OpenStreetMap."

Then find the leg that says **WALK INSTEAD**:

> "And this one's my favourite. It won't put me on a train for 600 metres. It just says
> walk."

Grab a stop by the handle and drag it somewhere else.

> "Move something, and the map redraws the route."

---

### Where I'm actually standing — 30 seconds

Click **✨ What should I do right now?**

> "This one asks my browser where I am. Then it checks the real forecast, what's open
> around me, and what's left of today's money."

Read what it says out loud — it'll be a real café, a real walk, the real temperature.
Then drop the budget to $15 and ask again.

> "Fifteen dollars. Different answer."

---

### Just tell it — 15 seconds

Open the chat bubble. Type:

```
Move the bookstore to position 2
```

Watch the list reorder and the map follow.

> "It didn't tell me how to do that. It just did it."

---

### Land it

> "Eight agents. Live weather, live places, real transit, and it explains every call it
> makes. All of it on free tiers — the only thing we pay for is search, and there's a
> meter for that right in the app."

---

## If it wobbles

Don't apologise — the fallbacks are the point:

- Explore looks stale → the badge literally says *offline sample*. "It degraded and told
  me it degraded."
- Crew is slow → "Free models. There's a four-model failover behind it."
- Location denied → it uses the booked hotel. "That's the designed path."

## The two questions you'll get

**"How much of this is real?"** — Places, weather, walking distances, métro lines and
stations are live. Fares and per-mode times are modelled, and the app says so. No GTFS
feed, so nothing pretends to be a timetable.

**"What's the model actually doing?"** — Writing the prose and running the chat. The
ranking, routing and re-planning are deterministic. A rate limit costs you nicer
wording, never a wrong plan.
