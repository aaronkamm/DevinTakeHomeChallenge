"use client";

import { ErrorScreen, type ErrorBoundaryProps } from "@/app/_components/error-screen";

export default function RefundDetailError({ error, reset }: ErrorBoundaryProps) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Couldn't load this refund"
      message="We couldn't load this refund's details. This is usually temporary, so try again in a moment."
      showBackLink
    />
  );
}
