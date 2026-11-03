"use client";

import { ErrorScreen, type ErrorBoundaryProps } from "@/app/_components/error-screen";

/** Catches anything a page throws (e.g. the database being unavailable) below the root layout. */
export default function RootError({ error, reset }: ErrorBoundaryProps) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Something went wrong"
      message="We couldn't load this page. This is usually temporary, so try again in a moment."
    />
  );
}
