"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { CREW, INITIAL_CHAT, REPLIES, type ChatMessage } from "@/lib/mock/ui";
import { Eyebrow, MONO, SERIF } from "@/components/ui";

const ATLAS_FALLBACK =
  "On it. I’ll check that against today’s remaining $86, the 15:00 rain window and your 19:00 table, " +
  "then come back with two options — one that keeps the plan and one that rewrites the afternoon.";

export default function CrewChat() {
  const [chat, setChat] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [draft, setDraft] = useState("");

  const ask = (label: string) => {
    const r = REPLIES[label];
    setChat((c) => c.concat([{ user: true, text: label }, { agent: r.who, role: r.role, color: r.color, text: r.text }]));
  };

  const send = () => {
    const d = draft.trim();
    if (!d) return;
    setDraft("");
    setChat((c) =>
      c.concat([
        { user: true, text: d },
        { agent: "Atlas", role: "orchestrator", color: "#7A5AF8", text: ATLAS_FALLBACK },
      ]),
    );
  };

  return (
    <div style={{ animation: "wl-screen .46s cubic-bezier(.22,.68,.16,1) both", maxWidth: 880, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <Eyebrow style={{ marginBottom: 7, display: "flex", alignItems: "center", gap: 7 }}>
            <MessageCircle size={14} strokeWidth={2} color="currentColor" />
            8 agents on duty · Atlas answering first
          </Eyebrow>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.05 }}>
            Ask the crew
          </h1>
        </div>
        <div style={{ display: "flex" }}>
          {CREW.map((a, i) => {
            // Every third agent winks (one eye); each gets its own delay/duration so the crew
            // never blinks in unison. Derived from i, so it is stable across renders.
            const wink = i % 3 === 2;
            const eyeDur = `${(3.6 + (i % 5) * 0.6).toFixed(1)}s`;
            const eyeDelay = `${((i * 1.7) % 5).toFixed(1)}s`;
            return (
              <div
                key={a.name}
                title={`${a.name} · ${a.role}`}
                style={{ width: 30, height: 30, borderRadius: "50%", border: "2px solid #FBF8F3", marginLeft: -7, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, background: a.color }}
              >
                <span style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: wink ? "none" : `wl-blink ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                <span style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: `${wink ? "wl-wink" : "wl-blink"} ${eyeDur} infinite`, animationDelay: eyeDelay }} />
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          background: "#FFF",
          border: "1px solid var(--wl-line)",
          borderRadius: 24,
          padding: "clamp(14px,2vw,22px)",
          boxShadow: "0 1px 2px rgba(23,21,15,.03),0 18px 40px -28px rgba(23,21,15,.28)",
        }}
      >
        {chat.map((m, i) => {
          const isUser = !!m.user;
          // Same index-derived stagger as the crew stack above: every third speaker winks.
          const wink = i % 3 === 2;
          const eyeDur = `${(3.6 + (i % 5) * 0.6).toFixed(1)}s`;
          const eyeDelay = `${((i * 1.7) % 5).toFixed(1)}s`;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 16,
                animation: "wl-row .42s cubic-bezier(.22,.68,.16,1) both",
                flexDirection: isUser ? "row-reverse" : "row",
              }}
            >
              <div style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: isUser ? "#EDE5D8" : m.color }}>
                {isUser ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--wl-muted)" }}>SA</span>
                ) : (
                  <>
                    <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: wink ? "none" : `wl-blink ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                    <span style={{ width: 4.5, height: 4.5, borderRadius: "50%", background: "rgba(0,0,0,.6)", animation: `${wink ? "wl-wink" : "wl-blink"} ${eyeDur} infinite`, animationDelay: eyeDelay }} />
                  </>
                )}
              </div>
              <div
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  maxWidth: "min(100%,560px)",
                  borderRadius: 18,
                  padding: "14px 17px",
                  background: isUser ? "#17150F" : "#FBF8F3",
                  color: isUser ? "#FBF8F3" : "#3A352B",
                }}
              >
                {!isUser && (
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 6 }}>
                    {m.agent} · {m.role}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{m.text}</p>
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0 14px" }}>
          {Object.keys(REPLIES).map((label) => (
            <button
              key={label}
              onClick={() => ask(label)}
              style={{ border: "1px dashed var(--wl-line-2)", background: "transparent", color: "var(--wl-muted)", fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 999, textAlign: "left" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", borderTop: "1px solid #F3EDE3", paddingTop: 14 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about food, weather, money, anything…"
            style={{ flex: "1 1 220px", minWidth: 0, border: "1px solid var(--wl-line)", borderRadius: 999, padding: "13px 18px", font: "inherit", fontSize: 14.5, outline: "none", background: "var(--wl-bg)", color: "var(--wl-ink)" }}
          />
          <button onClick={send} style={{ flex: "0 0 auto", border: 0, background: "var(--wl-ink)", color: "var(--wl-bg)", fontSize: 14, fontWeight: 700, padding: "13px 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Send
            <Send size={16} strokeWidth={2} color="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
