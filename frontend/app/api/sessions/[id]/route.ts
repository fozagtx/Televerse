import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-store";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Allow demo mode without auth
  if (id === "demo") {
    const session = getSession(id);
    return session
      ? NextResponse.json(session)
      : NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = getSession(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
