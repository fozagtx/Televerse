import { NextResponse } from "next/server";
import { getIO } from "@/lib/socket";
import { getSession } from "@/lib/session-store";
import { auth } from "@/auth";
import { persistSessionStatus } from "@/lib/db/session-persist";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Trigger socket-driven worker stop. The session page emits
  // 'session:finish' on the same socket; we replicate that here so
  // programmatic agents can finalize a session without a browser tab.
  // The TypeScript server-to-client event union doesn't include
  // 'session:finish' (it's a client-to-server event in the typings), so
  // we cast through `unknown` for this bi-directional case.
  try {
    const io = getIO();
    const socket = io as unknown as {
      to: (room: string) => {
        emit: (event: string, payload: unknown) => void;
      };
    };
    socket.to(`session:${sessionId}`).emit("session:finish", { sessionId });
  } catch {
    // Socket not available (e.g. tests) — fall through, the session store
    // still gets marked completed below.
  }

  session.status = "completed";
  persistSessionStatus(sessionId, "completed").catch(console.error);

  return NextResponse.json({ status: "completed" });
}
