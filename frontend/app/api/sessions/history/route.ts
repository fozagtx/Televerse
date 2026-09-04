import { NextResponse } from "next/server";
import { getSession, getLatestThumbnail } from "@/lib/session-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await import("@/lib/session-store").then(m => m.getUserSessions("dev-user"));

    const sessionsWithThumbnails = sessions.map((s) => ({
      id: s.id,
      prompt: s.prompt,
      status: s.status,
      agentCount: s.agentCount,
      createdAt: new Date(s.createdAt).toISOString(),
      todos: s.todos.map(t => ({ id: t.id, status: t.status })),
      latestThumbnail:
        s.status === "running" ? getLatestThumbnail(s.id) : undefined,
    }));

    return NextResponse.json({ sessions: sessionsWithThumbnails });
  } catch (error) {
    console.error("[history] Failed to fetch session history:", error);
    return NextResponse.json(
      { error: "Failed to fetch session history" },
      { status: 500 }
    );
  }
}
