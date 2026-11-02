import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { ActorSwitcher, ActorSwitcherSkeleton } from "@/app/_components/actor-switcher";
import { getCurrentActor } from "@/lib/actor";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Refunds Dashboard",
  description: "Review and approve customer refund requests",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ActorBar />
        {children}
      </body>
    </html>
  );
}

/** A thin strip above every screen showing who decisions will be recorded as. */
function ActorBar() {
  return (
    <div className="border-b border-slate-200 bg-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-2">
        <p className="text-xs text-slate-500">
          Demo mode: no sign-in. Pick who you are acting as.
        </p>
        {/* The actor comes from request cookies, so it streams in without holding up the page. */}
        <Suspense fallback={<ActorSwitcherSkeleton />}>
          <CurrentActorSwitcher />
        </Suspense>
      </div>
    </div>
  );
}

async function CurrentActorSwitcher() {
  const actor = await getCurrentActor();
  // Keyed on the actor so the select resets to the server's value after every switch.
  return <ActorSwitcher key={`${actor.role}:${actor.name}`} current={actor} />;
}
