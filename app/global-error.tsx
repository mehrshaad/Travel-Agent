"use client";

import "./globals.css";
import { ErrorState } from "@/components/ErrorState";

/**
 * Last resort: this fires when the root layout itself throws, so it replaces the layout
 * and has to render <html> and <body> on its own. globals.css is imported here because
 * the layout that normally loads it is the thing that failed; the literal colours on
 * <body> are the backstop if even that import does not make it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FBF8F3", color: "#17150F", fontFamily: "Manrope, system-ui, sans-serif" }}>
        <ErrorState error={error} reset={reset} />
      </body>
    </html>
  );
}
