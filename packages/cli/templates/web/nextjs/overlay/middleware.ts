import { NextResponse, type NextRequest } from "next/server";

// Baseline security headers on every response, matching the OmniCraft JSON
// API stacks (helmet/hono defaults). Header-setting middleware is
// runtime-agnostic, so it behaves identically on every Next.js runtime.
//
// Deliberately no rate limiting here: a limiter needs per-process in-memory
// state, which middleware runtimes do not honestly guarantee — the API
// rate-limit baseline for this overlay is a separate, runtime-aware decision.
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
