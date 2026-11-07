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
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
