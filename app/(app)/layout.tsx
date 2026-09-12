"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { NAV_ITEMS } from "@/lib/mock/ui";
import { useEffect, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // CopilotKit 1.71 calls new URL(runtimeUrl) with no base, so a relative path throws
  // "Invalid URL" — and it also refuses to render without one, so it cannot simply be
  // deferred. The server gets a syntactically valid placeholder it never fetches with;
  // the browser swaps in its real origin on mount, before any request is made.
  const [runtimeUrl, setRuntimeUrl] = useState("http://localhost/api/copilotkit");
  useEffect(() => setRuntimeUrl(`${window.location.origin}/api/copilotkit`), []);

  /** Place detail is reached from Today, so Today stays lit while you're on it. */
  const activeKey = pathname.startsWith("/place") ? "today" : pathname.slice(1);

  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(251,248,243,.88)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--wl-line)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px clamp(16px,3vw,34px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.png" alt="Waylo" style={{ width: 27, height: 27, borderRadius: 9, display: "block" }} />
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", color: "var(--wl-ink)" }}>
                Waylo
              </span>
            </Link>
            <nav style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {NAV_ITEMS.map((n) => {
                const on = activeKey === n.key;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      padding: "9px 14px",
                      borderRadius: 999,
                      background: on ? "var(--wl-ink)" : "transparent",
                      color: on ? "var(--wl-bg)" : "var(--wl-muted)",
                    }}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.push("/activity")}
              style={{
                position: "relative",
                border: "1px solid #E4DBCC",
                background: "#FFF",
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--wl-ink)",
                padding: "9px 15px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Bell size={16} strokeWidth={2} color="currentColor" />
              Activity
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "#F2724B",
                  color: "#FFF",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                }}
              >
                3
              </span>
            </button>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#EDE5D8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "var(--wl-muted)",
              }}
            >
              SA
            </div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "clamp(18px,3vw,34px) clamp(16px,3vw,34px) 64px" }}>{children}</main>

      {/* The crew, reachable from any screen. It can read the trip and act on it —
          see the useCopilotAction calls in the Today screen. */}
      <CopilotSidebar
        labels={{
          title: "Ask the crew",
          initial:
            "I can see your plan, the forecast and what you have left to spend. Try: " +
            "\"move the bookstore before lunch\", \"what should I do right now?\", or " +
            "\"I only have $20 left\".",
        }}
        instructions={
          "You are Waylo's travel crew: Atlas orchestrates, Nimbus watches weather, Morsel handles food, " +
          "Dash handles transport, Echo learns preferences. You are helping someone mid-trip in Montreal. " +
          "Use the provided readable context for the plan, budget and weather. When the traveller asks to " +
          "change the day, CALL THE ACTIONS rather than describing what they should do. Never invent a " +
          "place, price or opening time that is not in the context or returned by an action. Keep replies " +
          "to two or three sentences."
        }
        defaultOpen={false}
        clickOutsideToClose
      />
    </div>
    </CopilotKit>
  );
}
