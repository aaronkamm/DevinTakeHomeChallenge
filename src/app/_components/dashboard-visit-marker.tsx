"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const VISITED_KEY = "refunds-dashboard:visited";

/**
 * Notes in this tab's sessionStorage that a real dashboard page has been shown. The broken-link page
 * uses it to decide whether "Go back" can return somewhere in the app, or whether the visitor
 * arrived straight from a pasted link (a fresh tab still has Chrome's New Tab page in its history).
 */
export function DashboardVisitMarker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/invalid-link") return;
    try {
      sessionStorage.setItem(VISITED_KEY, "1");
    } catch {
      // Storage can be blocked (strict privacy settings); "Go back" then just goes home.
    }
  }, [pathname]);

  return null;
}

export function hasVisitedDashboard(): boolean {
  try {
    return sessionStorage.getItem(VISITED_KEY) === "1";
  } catch {
    return false;
  }
}
