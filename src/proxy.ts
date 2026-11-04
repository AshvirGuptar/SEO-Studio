import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { checkBasicAuth } from "@/lib/auth/basic-auth";
import { authEnvConfigured } from "@/lib/auth/enabled";

/** Paths reachable without signing in. */
const PUBLIC_PATHS = ["/sign-in", "/api/auth"];

/**
 * 1. Optional site-wide password (HTTP Basic Auth) when SITE_PASSWORD is set.
 * 2. When Google sign-in is configured, signed-out visitors are sent to /sign-in (API calls get 401).
 *    This is an optimistic cookie check; pages and API routes verify the session for real.
 */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const user = process.env.SITE_USERNAME || "team";
    if (!checkBasicAuth(request.headers.get("authorization"), user, password)) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="SEO Studio", charset="UTF-8"' },
      });
    }
  }

  if (authEnvConfigured()) {
    const { pathname, search } = request.nextUrl;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!isPublic && !getSessionCookie(request)) {
      if (pathname.startsWith("/api/")) return Response.json({ error: "Please sign in." }, { status: 401 });
      const url = new URL("/sign-in", request.url);
      if (pathname !== "/") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
