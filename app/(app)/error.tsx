"use client";

import { ErrorState } from "@/components/ErrorState";

/**
 * Boundary for the signed-in shell. It renders inside <main>, below the sticky header,
 * so it asks for less than a full viewport — the nav stays usable while it shows.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} minHeight="60vh" />;
}
