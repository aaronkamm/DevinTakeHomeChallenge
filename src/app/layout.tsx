import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";

import { DashboardVisitMarker } from "@/app/_components/dashboard-visit-marker";
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
        {children}
        {/* usePathname suspends on dynamic routes under Cache Components; it renders nothing anyway. */}
        <Suspense fallback={null}>
          <DashboardVisitMarker />
        </Suspense>
      </body>
    </html>
  );
}
