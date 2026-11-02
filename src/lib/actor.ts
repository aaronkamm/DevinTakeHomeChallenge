import { cookies } from "next/headers";

import { DEFAULT_REVIEWER, findReviewer, type Reviewer } from "./reviewers";

export type CurrentActor = Reviewer;

export const ACTOR_NAME_COOKIE = "actor_name";
export const ACTOR_ROLE_COOKIE = "actor_role";

/**
 * Who is using the dashboard right now. There is no sign-in: the "Acting as" switcher stores a
 * name and role in cookies, and this reads them back. Anything missing, or a name/role pair that
 * isn't on the seeded roster, falls back to the default agent.
 *
 * Reads request cookies, so callers must render inside a `<Suspense>` boundary (Cache Components).
 */
export async function getCurrentActor(): Promise<CurrentActor> {
  const store = await cookies();
  return (
    findReviewer(store.get(ACTOR_NAME_COOKIE)?.value, store.get(ACTOR_ROLE_COOKIE)?.value) ??
    DEFAULT_REVIEWER
  );
}
