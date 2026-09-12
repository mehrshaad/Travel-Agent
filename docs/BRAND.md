# Brand tokens

Sampled from the app icon (`images/image.png`) — a map pin whose body is a mountain
under a rising sun. Use these instead of picking new colors, so the UI, the map pins,
and the agent panel read as one product.

| Role | Hex | From the icon |
|---|---|---|
| `--bg` | `#FCF1E5` | cream field |
| `--ink` | `#035055` | deep teal (mountain, pin body) |
| `--ink-soft` | `#1D9391` | mid teal (lit mountain face) |
| `--accent` | `#FC9743` | orange sun halo |
| `--accent-warm` | `#FCAF3E` | orange, lighter |
| `--sun` | `#FDC03E` | yellow sun disc |

```css
:root {
  --bg: #FCF1E5;
  --surface: #FFFFFF;
  --ink: #035055;
  --ink-soft: #1D9391;
  --muted: #6B7F80;
  --accent: #FC9743;
  --accent-warm: #FCAF3E;
  --sun: #FDC03E;
  --border: #E4D8C9;
}

:root[data-theme="dark"] {
  --bg: #04282B;
  --surface: #073C40;
  --ink: #FCF1E5;
  --ink-soft: #9BC4C3;
  --muted: #7FA0A0;
  --accent: #FC9743;
  --accent-warm: #FCAF3E;
  --sun: #FDC03E;
  --border: #0C565A;
}
```

## Semantic use

- **Teal is structure** — text, pin bodies, headers, the itinerary spine.
- **Orange is agency** — anything an agent did or proposes: the replan banner, the
  ✨ "What should I do now?" button, active agent rows.
- **Yellow is highlight only** — a pinned item, the current time marker. Sparingly.
- **Weather states** need their own greys/blues; don't force them into brand colors, or
  a rain warning stops reading as a warning.

Icon is `images/image.png` at 1254×1254. Needs deriving into `favicon.ico`, `apple-touch-icon.png`,
and a 32px version — Lane A (Ali).
