# AGENTS.md — Waylo

Auto-loaded by Codex, Claude Code, and Cursor. **Read before editing anything.**
Humans: this is also the contributing guide. There is no second document.

We are three people driving three AI coding agents on one repo at hackathon speed.
Every rule below exists to stop the failure mode that kills projects like this:
**three agents independently "improving" the same files until nothing merges.**

---

## 1. The one unbreakable rule

> **`types/index.ts` has a single owner. You do not edit it.**

Everything imports it. If all three lanes edit it, every branch conflicts in the one
file the whole project depends on, and the conflict is semantic — not the kind git
resolves.

Need a type changed or added? **Ask the lead. Do not edit, do not work around it, and
do not define a local duplicate type.** A duplicated `Place` interface in your lane is
worse than waiting ten minutes.

The same applies to `docs/API_CONTRACT.md`.

---

## 2. Lane ownership

Edit only inside your lane. Do not edit another lane's files — even to fix something
obviously broken. Report it instead.

| Lane | Owner | Owns |
|---|---|---|
| **A — UI** | Ali | `app/(ui)/**`, `components/**`, `styles/**`, `hooks/**` |
| **B — Data & tools** | Sara | `lib/providers/**`, `lib/cache/**` |
| **C — Agents** | Paria | `lib/agents/**`, `lib/llm/**` |
| **Lead** | Ali + Claude | `types/**`, `docs/**`, `app/api/**`, `lib/itinerary/**` |

Shared files (`package.json`, config, lockfile) — see §5.

---

## 3. Rules for your AI agent

Paste these into your agent's instructions, or let it read this file. These are the
behaviors that cause merge conflicts, not style preferences.

1. **Every changed line must trace to the assigned task.** If you cannot explain why a
   line changed, revert it.
2. **No unrequested refactors.** Not in adjacent code, not "while I'm here", not for
   readability. Notice a problem in someone else's code → say so, don't fix it.
3. **No renaming** existing functions, variables, files, or exports. Renames produce
   diffs that look like rewrites and conflict with everything.
4. **No reformatting.** Prettier config is committed. Run it, don't fight it. A
   whitespace-only diff across a file you touched is a merge conflict for someone else.
5. **Never regenerate a whole file.** Edit surgically. Agents love rewriting a file
   "cleanly" — that discards a teammate's uncommitted work and blows up review.
6. **No new dependencies without asking.** Three agents each picking a different date
   library is a real outcome. See §5.
7. **No speculative abstraction.** No config layers, plugin systems, or generic
   wrappers for single-use code. Hackathon code ships once.
8. **No new top-level directories.** Work inside the structure in §2.
9. **Don't delete code you didn't write**, including code that looks dead.
10. **When blocked or when the task seems to require breaking a rule above — stop and
    ask.** Do not improvise around a rule.

---

## 4. Mock-first is mandatory

**Every endpoint ships its `?mock=1` fixture before its real implementation.**

This is what lets three lanes work in parallel. The UI must never wait on a working
agent, and an agent must never wait on a working provider.

- Fixtures live in `lib/mock/fixtures/`.
- A fixture must be a **valid, fully-populated** instance of its type — including
  `why`, `confidence`, and edge cases like `openNow: undefined`.
- A half-filled fixture is worse than none: the UI gets built against a shape that
  doesn't match reality, and that surfaces at integration time — the worst time.
- Same rule inside the stack: publish your module's **interface** before its
  implementation, so the lane downstream can start.

---

## 5. Shared files

`package.json`, `package-lock.json`, `tsconfig.json`, `next.config.*`, CI config.

- **Adding a dependency requires a message to the team first.** Not permission —
  just say it, so two people don't add two different libraries for the same job.
- One person adds it, pushes, everyone else pulls before continuing.
- Lockfile conflicts are never hand-merged. Take `main`'s version, re-run install:
  ```bash
  git checkout --theirs package-lock.json && npm install
  ```
- Use `npm ci` locally, not `npm install`, unless you are deliberately changing deps.

---

## 6. Git

- **Never commit to `main`.** No exceptions, including one-line fixes.
- Branch: `lane-<a|b|c>/<short-desc>` → `lane-b/overpass-provider`
- **Rebase, never merge**: `git pull --rebase origin main`
- **Rebase onto `main` at least twice a day.** A branch that hasn't been rebased since
  morning is a conflict waiting to happen.
- **Small PRs.** One feature. If a PR touches more than ~8 files, split it.
- PRs need one approval — but do not sit blocked waiting. Ping, then continue on a
  branch stacked on yours.

**Commit format**: `<type>(<lane>): <what changed>`

```
feat(b): add Overpass POI provider with tile cache
fix(a): itinerary card no longer renders "closed" when hours unknown
chore: pin openrouter sdk
```

Types: `feat` `fix` `chore` `docs` `refactor` `test`

**Never add AI attribution to commits or PRs.** No `Co-Authored-By: Claude`,
no "Generated with", no agent trailers of any kind. This is a hard rule.

---

## 7. Definition of done

A task is done when all of these are true — not when the code was written:

- [ ] `npx tsc --noEmit` passes
- [ ] Mock fixture exists and is fully populated
- [ ] Real implementation returns the **same shape** as the mock
- [ ] Response conforms to `ApiResponse<T>` — including the error path
- [ ] Degradation path works: provider down / LLM returns garbage → still valid shape,
      lower `confidence`, no crash
- [ ] Rebased on `main` and pushed

"It works on my branch with my API key" is not done.

---

## 8. Free-tier realities

These are constraints, not suggestions. Verified 2026-09-12.

- **Free LLMs return malformed JSON and rate-limit.** Every agent must have a
  non-LLM fallback that produces a valid response. Validate, retry once, then fall back
  to rule-based ranking. Never let a model failure produce a 500.
- **Exa: $10 ≈ 1,400 searches** at $0.007/call. Cache every response to disk, keyed by
  `(normalized_query, city, section)`. Use Overpass (free) for anything structured;
  spend Exa only on free-text local knowledge.
- **Nominatim: 1 req/s**, requires a real `User-Agent`. Cache by query string.
- **Never commit an API key.** `.env.local` only; it is gitignored. If you leak one,
  say so immediately — rotating a key takes two minutes, a compromised repo does not.

---

## 9. Working agreements

- **Blocked more than 20 minutes → say so in the team channel.** Grinding alone is the
  single most expensive thing you can do here.
- Changing something another lane depends on → announce before you push, not after.
- Daily: rebase, 3-line status (done / doing / blocked).
- **Feature freeze 4 hours before the deadline.** After the freeze: bugfixes, demo
  script, and seeding the demo city cache. No new features, regardless of how small.
