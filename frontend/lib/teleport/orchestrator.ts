/**
 * Teleport orchestrator.
 *
 * Given a primary session, a side task, and a return mode, this:
 *
 *   1. Captures the TeleportContext from the primary session.
 *   2. Creates a fresh child session (a separate Televerse session with
 *      its own sandbox/agents/stream URL).
 *   3. Writes the formatted context into the child session's whiteboard
 *      and seeds a single todo so the worker has exactly one task to
 *      perform: the side task itself, grounded in the primary context.
 *   4. Spawns a single worker (we deliberately use one agent for
 *      teleports — the side task is typically focused, and we want
 *      the workspace to be a clean slate, not a parallel multi-agent
 *      explosion).
 *   5. Persists the Teleport record so the API + UI can read it.
 *
 * The "isolation" guarantee comes from Televerse's existing session
 * model: a different `Session` means a different E2B sandbox, a
 * different Socket.io room, and a different whiteboard. The primary
 * agent's session is not touched.
 */

import { v4 as uuidv4 } from "uuid";
import {
  addTodos,
  createSession,
  getSession,
  updateWhiteboard,
} from "@/lib/session-store";
import {
  persistSession,
  persistTodos,
  persistSessionStatus,
} from "@/lib/db/session-persist";
import { spawnWorkers } from "@/lib/worker-manager";
import { captureContext, formatContextForPrompt } from "./context";
import { createTeleport, updateTeleportStatus } from "./store";
import type { TeleportContext, ReturnMode } from "./types";

export interface CreateTeleportRequest {
  userId: string;
  primarySessionId: string;
  sideTask: string;
  returnMode?: ReturnMode;
  relevantFiles?: string[];
  recentErrors?: string[];
  constraints?: string[];
  agentCount?: number;
}

export interface CreateTeleportResult {
  ok: true;
  teleportId: string;
  childSessionId: string;
  primarySessionId: string;
  status: string;
  watchUrl: string;
  childWatchUrl: string;
}

export interface CreateTeleportError {
  ok: false;
  status: number;
  error: string;
}

export type CreateTeleportOutcome = CreateTeleportResult | CreateTeleportError;

export async function createAndLaunchTeleport(
  req: CreateTeleportRequest,
): Promise<CreateTeleportOutcome> {
  if (!req.sideTask.trim()) {
    return { ok: false, status: 400, error: "sideTask is required" };
  }

  const captured = captureContext({
    primarySessionId: req.primarySessionId,
    sideTask: req.sideTask,
    returnMode: req.returnMode ?? "report",
    relevantFiles: req.relevantFiles,
    recentErrors: req.recentErrors,
    constraints: req.constraints,
  });
  if ("error" in captured) {
    return { ok: false, status: 404, error: captured.error };
  }
  const context: TeleportContext = captured;

  const primary = getSession(req.primarySessionId);
  if (!primary) {
    return { ok: false, status: 404, error: "Primary session not found." };
  }
  if (primary.userId && primary.userId !== req.userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Spawn the child session. Single agent by default — keeps the
  // workspace tight and avoids the multi-lane orchestration that the
  // primary session is already doing.
  const childSessionId = uuidv4();
  const agentCount = Math.max(1, Math.min(req.agentCount ?? 1, 2));
  const childPrompt = formatContextForPrompt(context);

  createSession(childSessionId, childPrompt, agentCount, req.userId, false);

  // Pre-bake the context into the whiteboard so worker.py sees it on
  // first turn (the worker injects whiteboard content into the system
  // prompt today).
  const whiteboard = [
    "## TELEPORT CONTEXT (read first)",
    "",
    childPrompt,
    "",
    "## Workspace",
    "",
    "You are running in an isolated Televerse sandbox. Do not assume",
    "access to the primary session's files or processes. Use your own",
    "browser and terminal freely; collect evidence; do not commit.",
  ].join("\n");
  updateWhiteboard(childSessionId, whiteboard);

  // Persist child session to DB.
  persistSession(
    childSessionId,
    req.userId,
    childPrompt,
    agentCount,
    "running",
    false,
  ).catch(console.error);

  // Single todo: the side task. Decomposition is unnecessary here —
  // the worker can do its own internal planning via the agent loop.
  const todo = {
    id: uuidv4(),
    description: req.sideTask.trim(),
    status: "pending" as const,
    assignedTo: null,
  };
  addTodos(childSessionId, [todo.description]);
  persistTodos(childSessionId, [todo]).catch(console.error);
  persistSessionStatus(childSessionId, "running").catch(console.error);

  // Record the teleport in the store.
  const teleport = createTeleport({
    userId: req.userId,
    primarySessionId: req.primarySessionId,
    childSessionId,
    sideTask: req.sideTask,
    returnMode: req.returnMode,
    context,
  });
  updateTeleportStatus(teleport.id, "context_captured", "Context captured.");
  updateTeleportStatus(
    teleport.id,
    "provisioning",
    "Spawning isolated sandbox for teleported agent.",
  );

  // Spawn the worker(s) for the child session.
  try {
    spawnWorkers(childSessionId, agentCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateTeleportStatus(teleport.id, "failed", `Spawn failed: ${message}`);
    return { ok: false, status: 500, error: `Failed to spawn worker: ${message}` };
  }

  updateTeleportStatus(
    teleport.id,
    "running",
    "Teleported agent is online. Beginning investigation.",
  );

  return {
    ok: true,
    teleportId: teleport.id,
    childSessionId,
    primarySessionId: req.primarySessionId,
    status: teleport.status,
    watchUrl: `/teleport/${teleport.id}`,
    childWatchUrl: `/session/${childSessionId}`,
  };
}
