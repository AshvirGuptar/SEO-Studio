import { toNextJsHandler } from "better-auth/next-js";
import { getAuth, isAuthEnabled } from "@/lib/auth/server";

const notConfigured = () => Response.json({ error: "Sign-in is not configured." }, { status: 404 });

export async function GET(request: Request) {
  if (!isAuthEnabled()) return notConfigured();
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  if (!isAuthEnabled()) return notConfigured();
  return toNextJsHandler(getAuth()).POST(request);
}
