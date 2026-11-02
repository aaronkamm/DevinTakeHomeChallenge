"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";

import { ACTOR_NAME_COOKIE, ACTOR_ROLE_COOKIE } from "@/lib/actor";
import { findReviewer } from "@/lib/reviewers";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Switches who the dashboard records as acting, then re-renders the current page for them. */
export async function setCurrentActor(name: string, role: string) {
  // Server actions are public endpoints, so only accept actors from the roster.
  const actor = findReviewer(name, role);
  if (!actor) throw new Error("Unknown actor");

  const store = await cookies();
  const options = { path: "/", sameSite: "lax", httpOnly: true, maxAge: ONE_YEAR_SECONDS } as const;
  store.set(ACTOR_NAME_COOKIE, actor.name, options);
  store.set(ACTOR_ROLE_COOKIE, actor.role, options);
  refresh();
}
