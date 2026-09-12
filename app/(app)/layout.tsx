"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/mock/ui";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /** Place detail is reached from Today, so Today stays lit while you're on it. */
  const activeKey = pathname.startsWith("/place") ? "today" : pathname.slice(1);

  return (
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
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 9,
                  background: "linear-gradient(135deg,#F2724B,#F2A93B)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBF8F3" }} />
              </div>
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
              }}
            >
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
    </div>
  );
}
