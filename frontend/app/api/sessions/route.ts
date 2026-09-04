import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { approveSession, createSession, addTodos, getSession } from "@/lib/session-store";
import { getMaxAgentsForUser } from "@/lib/billing";

export const dynamic = "force-dynamic";
import {
  persistSession,
  persistTodos,
  persistSessionStatus,
} from "@/lib/db/session-persist";
import { decomposeTasks, type DecomposedTask } from "@/lib/orchestrator";
import { spawnWorkers } from "@/lib/worker-manager";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const { prompt, agentCount, autoStart = false } = body as {
    prompt: string;
    agentCount: number;
    autoStart?: boolean;
  };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (
    !agentCount ||
    typeof agentCount !== "number" ||
    agentCount < 1 ||
    agentCount > 4
  ) {
    return NextResponse.json(
      { error: "agentCount must be between 1 and 4" },
      { status: 400 },
    );
  }

  const maxAgents = await getMaxAgentsForUser("dev-user");
  if (agentCount > maxAgents) {
    return NextResponse.json(
      {
        error: `Your plan allows up to ${maxAgents} agents.`,
        code: "PLAN_LIMIT_EXCEEDED",
        maxAgents,
      },
      { status: 403 },
    );
  }

  const sessionId = uuidv4();
  createSession(sessionId, prompt.trim(), agentCount, "dev-user");

  // Persist session to database
  persistSession(
    sessionId,
    "dev-user",
    prompt.trim(),
    agentCount,
    "decomposing"
  ).catch(console.error);

  // A single agent can execute the original instruction directly. This keeps
  // sandbox boot independent from the optional decomposition service.
  let todoDescriptions: DecomposedTask[];
  try {
    todoDescriptions =
      agentCount === 1
        ? [{ description: prompt.trim(), lane: 0 }]
        : await decomposeTasks(prompt.trim(), agentCount);
  } catch (error) {
    console.error("[orchestrator] Failed to decompose prompt; using direct task:", error);
    todoDescriptions = [{ description: prompt.trim(), lane: 0 }];
  }

  // Add TODOs to session — do NOT start workers yet
  const todos = addTodos(sessionId, todoDescriptions);

  // Persist todos to database
  persistTodos(sessionId, todos).catch(console.error);

  const opticonSession = getSession(sessionId);
  if (autoStart) {
    if (!opticonSession) {
      return NextResponse.json({ error: "Session was not created" }, { status: 500 });
    }
    // Keep the existing state machine contract, then start workers immediately.
    opticonSession.status = "pending_approval";
    approveSession(sessionId);
    persistSessionStatus(sessionId, "running").catch(console.error);
    spawnWorkers(sessionId, agentCount);
  } else if (opticonSession) {
    // Set session to pending_approval so legacy approval screens keep working.
    opticonSession.status = "pending_approval";
    persistSessionStatus(sessionId, "pending_approval").catch(console.error);
  }

  return NextResponse.json(
    { sessionId, tasks: todos, status: autoStart ? "running" : "pending_approval" },
    { status: 201 }
  );
}
