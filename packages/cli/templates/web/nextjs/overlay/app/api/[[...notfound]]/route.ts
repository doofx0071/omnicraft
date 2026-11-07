import { NextResponse } from "next/server";

// Unmatched /api routes answer with the same JSON 404 contract as the
// OmniCraft separate-API backends: HTTP 404, application/json,
// {error: "Not found"}.
//
// Next.js route specificity guarantees the static routes (app/api/users) and
// the dynamic [id] route win over this optional catch-all, so known
// resources keep their own response shapes. The optional segment is what
// also matches a bare request to /api. Paths outside app/api (page routes
// such as /apix) never reach this handler — Next's page routing keeps its
// own default 404 page.
// Every verb is exported so the contract is method-agnostic, matching the
// all-method 404 handlers in the separate-API backends (Express middleware,
// Fastify's not-found handler, Hono's app.all, Laravel's Route::any).
// Without an export Next.js would answer 405 for that verb instead.
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
