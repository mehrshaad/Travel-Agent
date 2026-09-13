"use client";

import { ErrorState } from "@/components/ErrorState";

/** Catches render errors in any route not covered by a nested boundary. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} />;
}
