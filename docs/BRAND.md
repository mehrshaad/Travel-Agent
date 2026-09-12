# Brand tokens

Ported from the **Waylo Aurora** design canvas and implemented in
[`app/globals.css`](../app/globals.css). Use the CSS variables — do not hand-pick new hex values,
or the three lanes will drift into three different colour schemes.

## Surface & type

| Token | Hex | Use |
|---|---|---|
| `--wl-bg` | `#FBF8F3` | page ground |
| `--wl-card` | `#FFFFFF` | cards, sheets |
| `--wl-ink` | `#17150F` | primary text, dark panels |
| `--wl-ink-2` | `#3A352B` | body copy inside cards |
| `--wl-muted` | `#6B6458` | secondary text, eyebrows |
| `--wl-line` | `#EDE5D8` | borders |
| `--wl-accent` | `#E0603C` | links, primary CTA on a light ground |

## The crew palette — one hue per agent

This is the load-bearing idea in the design: **each agent owns a colour, and it never changes.**
A violet dot anywhere in the product means Atlas decided it. Keep it consistent or the whole
"which agent did this" affordance collapses.

| Agent | Role | Token | Hex |
|---|---|---|---|
| Atlas | orchestrator | `--wl-atlas` | `#7A5AF8` |
| Dash | transport | `--wl-dash` | `#1FA39A` |
| Morsel | food | `--wl-morsel` | `#F2724B` |
| Muse | attractions | `--wl-muse` | `#F2A93B` |
| Echo | personalization | `--wl-echo` | `#EA5E9B` |
| Nest | stay | `--wl-nest` | `#C9A227` |
| Nimbus | weather | `--wl-nimbus` | `#57C4E1` |
| Fixer | local needs | `--wl-fixer` | `#B9A27A` |

## Type

- **Display** — Instrument Serif, regular weight, `-.02em`. Every page title.
- **UI** — Manrope, 400–800.
- **Mono** — IBM Plex Mono, for eyebrows (11px, `.14em`, uppercase) and times/status.

Loaded via Google Fonts in `app/layout.tsx`. Helpers: `SERIF`, `MONO`, `<Eyebrow>` in
`components/ui.tsx`.

## Motion

Keyframes live in `globals.css`: `wl-screen` (page enter), `wl-row` (staggered list rows),
`wl-float` / `wl-float2` (hero cards), `wl-pulse` (live map pin), `wl-blink` (agent eyes),
`wl-spin` (loading). All are disabled under `prefers-reduced-motion`.

## App icon

`images/image.png`, served as `public/icon.png` — a map pin whose body is a mountain under a
rising sun. Its palette (cream, coral-orange, deep teal) is the same family as the UI, which is why
the two sit together; the UI tokens above are the authority for anything on screen.

Still to derive: `favicon.ico`, `apple-touch-icon.png`, 32px.
