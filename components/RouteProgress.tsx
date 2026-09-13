/**
 * Full-screen loading overlay, shown while a route segment is still resolving.
 *
 * Rendered from a `loading.tsx`, so Next mounts it the instant a navigation starts and
 * removes it when the segment is ready — no click interception of our own, and it covers
 * server components that are still fetching.
 *
 * It covers the whole viewport on purpose. The old version was a 3px bar, which meant a
 * slow screen looked like a frozen one: the previous page sat there, fully clickable,
 * while people pressed the tab again. Blurring what is behind it and swallowing pointer
 * events says "this is loading" without a word, and makes a second click impossible.
 *
 * The keyframes live here rather than in globals.css so this file is self-contained; the
 * names are prefixed to keep them out of everyone else's way.
 */
export function RouteProgress({ label }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <style>{CSS}</style>

      <div className="wl-load">
        <Art label={label ?? "On the way…"} />
      </div>

      <span className="wl-sr">Loading</span>
    </div>
  );
}

/**
 * The same car, inline.
 *
 * For waits that happen *inside* a screen that has already rendered — a live search, a
 * trip still loading out of session storage — where covering the whole viewport would be
 * heavy-handed. Screens used to write their own "Loading…" line, so every wait in the app
 * looked like a different app.
 */
export function Loader({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={compact ? "wl-load-inline wl-load-compact" : "wl-load-inline"}
    >
      <style>{CSS}</style>
      <Art label={label ?? "Working on it…"} />
      <span className="wl-sr">Loading</span>
    </div>
  );
}

function Art({ label }: { label: string }) {
  return (
    <div className="wl-load-card">
      <svg
        className="wl-load-art"
        viewBox="0 0 240 96"
        width="240"
        height="96"
        aria-hidden="true"
        focusable="false"
      >
        {/* The road holds still and its markings move, which is cheaper to animate
                than the car and reads the same way. */}
        <line className="wl-road" x1="0" y1="78" x2="240" y2="78" />
        <line className="wl-dashes" x1="0" y1="78" x2="240" y2="78" />

        <g className="wl-car">
          <path
            className="wl-car-body"
            d="M40 66 L40 54 Q40 49 45 48 L69 48 L80 37 Q83 34 88 34 L118 34 Q124 34 127 38 L134 48 L156 51 Q164 52 164 59 L164 66 Z"
          />
          <path className="wl-car-glass" d="M86 47 L95 39 L114 39 L120 47 Z" />
          <circle className="wl-wheel" cx="63" cy="66" r="10" />
          <circle className="wl-wheel wl-wheel-2" cx="141" cy="66" r="10" />
          <circle className="wl-hub" cx="63" cy="66" r="3" />
          <circle className="wl-hub" cx="141" cy="66" r="3" />
        </g>

        {/* Three puffs, staggered, so the car reads as moving rather than parked. */}
        <circle className="wl-puff" cx="30" cy="60" r="3.5" />
        <circle className="wl-puff wl-puff-2" cx="30" cy="60" r="3.5" />
        <circle className="wl-puff wl-puff-3" cx="30" cy="60" r="3.5" />
      </svg>

      <p className="wl-load-label">{label}</p>

      <div className="wl-load-bar">
        <span />
      </div>
    </div>
  );
}

const CSS = `
.wl-load{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;
  padding:24px;background:rgba(251,248,243,.72);backdrop-filter:blur(7px) saturate(1.1);
  -webkit-backdrop-filter:blur(7px) saturate(1.1);animation:wl-load-in .18s ease-out both}
.wl-load-inline{display:flex;align-items:center;justify-content:center;padding:38px 16px}
.wl-load-compact{padding:18px 12px}
.wl-load-compact .wl-load-art{width:168px}
.wl-load-card{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:min(100%,320px)}
.wl-load-art{max-width:100%;height:auto;overflow:visible}

.wl-road{stroke:#E4DBCC;stroke-width:3;stroke-linecap:round}
.wl-dashes{stroke:#C9BFAE;stroke-width:3;stroke-linecap:round;stroke-dasharray:16 18;
  animation:wl-road-run .55s linear infinite}

.wl-car{animation:wl-car-bob 1.15s ease-in-out infinite;transform-origin:100px 60px}
.wl-car-body{fill:#17150F}
.wl-car-glass{fill:#FBF8F3;opacity:.92}
.wl-wheel{fill:#17150F;stroke:#F2A93B;stroke-width:2.5;stroke-dasharray:5 5;
  transform-box:fill-box;transform-origin:center;animation:wl-wheel-spin .55s linear infinite}
.wl-hub{fill:#FBF8F3}
.wl-puff{fill:#C9BFAE;opacity:0;animation:wl-puff-off 1.2s ease-out infinite}
.wl-puff-2{animation-delay:.4s}
.wl-puff-3{animation-delay:.8s}

.wl-load-label{margin:0;font-size:14px;font-weight:600;color:#6B6458;text-align:center}
.wl-load-bar{position:relative;width:150px;height:3px;border-radius:999px;overflow:hidden;background:rgba(23,21,15,.08)}
.wl-load-bar span{position:absolute;top:0;height:100%;border-radius:999px;
  background:linear-gradient(90deg,#F2724B,#F2A93B);animation:wl-progress 1.1s cubic-bezier(.4,0,.2,1) infinite}

.wl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

@keyframes wl-load-in{from{opacity:0}to{opacity:1}}
@keyframes wl-road-run{to{stroke-dashoffset:-34}}
@keyframes wl-wheel-spin{to{transform:rotate(360deg)}}
@keyframes wl-car-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes wl-puff-off{0%{opacity:.5;transform:translate(0,0) scale(.7)}100%{opacity:0;transform:translate(-26px,-9px) scale(1.5)}}

/* Someone who has asked for less motion still needs to know the app is busy, so the
   overlay stays and only the movement goes. */
@media (prefers-reduced-motion:reduce){
  .wl-dashes,.wl-car,.wl-wheel,.wl-puff,.wl-load-bar span,.wl-load{animation:none}
  .wl-puff{opacity:0}
  .wl-load-bar span{left:0;width:100%;opacity:.55}
}
`;
