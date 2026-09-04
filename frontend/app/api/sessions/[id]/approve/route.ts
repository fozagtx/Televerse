import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

import {
  getSession,
  approveSession,
  updateTodos,
} from "@/lib/session-store";
import { getIO } from "@/lib/socket";
import { spawnWorkers } from "@/lib/worker-manager";
import type { Todo } from "@/lib/types";
import { auth } from "@/auth";
import { getMaxAgentsForUser } from "@/lib/billing";
import {
  replaceTodos,
  persistSessionStatus,
} from "@/lib/db/session-persist";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "pending_approval") {
    return NextResponse.json(
      { error: "Session is not pending approval" },
      { status: 400 }
    );
  }

  const maxAgents = await getMaxAgentsForUser("dev-user");

  const body = await request.json();
  const { tasks, agentCount } = body as {
    tasks: { id: string; description: string }[];
    agentCount: number;
  };

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json(
      { error: "At least one task is required" },
      { status: 400 }
    );
  }

  if (!agentCount || agentCount < 1 || agentCount > 4) {
    return NextResponse.json(
      { error: "agentCount must be between 1 and 4" },
      { status: 400 }
    );
  }

  if (agentCount > maxAgents) {
    return NextResponse.json(
      {
        error: `Your plan allows up to ${maxAgents} agents.`,
        code: "PLAN_LIMIT_EXCEEDED",
        maxAgents,
      },
      { status: 403 }
    );
  }

  // Update tasks — assign new IDs for any tasks added by the user
  const updatedTodos: Todo[] = tasks.map((t) => ({
    id: t.id.startsWith("new-") ? uuidv4() : t.id,
    description: t.description,
    status: "pending" as const,
    assignedTo: null,
  }));

  updateTodos(sessionId, updatedTodos.map((t) => t.description));
  session.agentCount = agentCount;

  // Persist updated todos to database
  replaceTodos(sessionId, updatedTodos).catch(console.error);

  // Approve: sets status to "running"
  approveSession(sessionId);

  // Persist status update
  persistSessionStatus(sessionId, "running").catch(console.error);

  // Emit task:created events
  try {
    const io = getIO();
    for (const todo of updatedTodos) {
      io.to(`session:${sessionId}`).emit("task:created", todo);
    }
  } catch {
    console.warn("[approve] Socket.io not available, skipping emit");
  }

  // Spawn worker processes
  spawnWorkers(sessionId, agentCount);

  return NextResponse.json({ status: "running" });
}
