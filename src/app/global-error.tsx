"use client";

import { ErrorScreen, type ErrorBoundaryProps } from "@/app/_components/error-screen";
import { fontVariables } from "@/app/fonts";
import "./globals.css";

/**
 * Catches errors in the root layout itself (e.g. the "Acting as" bar), which `error.tsx` can't.
 * It replaces the root layout, so it renders its own document with the same fonts and styles.
 * "Return to Refunds" does a full page load: a client-side navigation leaves this boundary showing.
 */
export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <title>Something went wrong · Refunds Dashboard</title>
        <ErrorScreen
          error={error}
          reset={reset}
          title="Something went wrong"
          message="We couldn't load the dashboard. This is usually temporary, so try again in a moment."
          fullReloadHome
        />
      </body>
    </html>
  );
}
