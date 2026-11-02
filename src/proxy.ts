import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends anyone with a garbled link (a stray "%" that isn't a valid escape, like `/refunds/50%off`
 * or a URL cut off mid-copy) to a friendly page instead of a bare error.
 *
 * Next decodes dynamic route params itself and, in production builds of an App Router-only app,
 * answers a malformed escape with a plain-text 500. Proxy runs before routing and still sees the
 * raw path, so we catch it here. A rewrite doesn't help, since Next still tries to decode the
 * original path, so it has to be a real redirect.
 *
 * We tag the redirect with `?from=app` when the broken link was followed from one of our own pages
 * (same-origin Referer), so the page's "Go back" button knows going back stays inside the dashboard.
 */
export function proxy(request: NextRequest) {
  try {
    decodeURIComponent(request.nextUrl.pathname);
    return NextResponse.next();
  } catch {
    const destination = new URL("/invalid-link", request.url);
    if (cameFromThisApp(request)) destination.searchParams.set("from", "app");
    return NextResponse.redirect(destination);
  }
}

function cameFromThisApp(request: NextRequest): boolean {
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export const config = {
  // Skip Next's own assets and metadata files so a normal page load doesn't run this for every
  // script and image.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
