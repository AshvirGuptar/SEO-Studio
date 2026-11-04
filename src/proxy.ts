import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/auth/basic-auth";

/**
 * Site-wide password gate. Active only when SITE_PASSWORD is set (e.g. on Vercel).
 * Username defaults to "team" (override with SITE_USERNAME).
 */
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.SITE_USERNAME || "team";
  if (checkBasicAuth(request.headers.get("authorization"), user, password)) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SEO Studio", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
