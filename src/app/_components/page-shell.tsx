import type { ReactNode } from "react";

import { BackLink } from "@/app/_components/back-link";

/**
 * The page frame every screen shares: a white header with the "Operations" eyebrow and title,
 * then the main content area. Keeping it in one place means the screens can't drift apart.
 */
export function PageShell({
  title,
  description,
  showBackLink = false,
  children,
}: {
  title: string;
  description?: string;
  showBackLink?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-5">
          {showBackLink && (
            <div className="mb-3">
              <BackLink />
            </div>
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Operations</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">{children}</div>
    </main>
  );
}
