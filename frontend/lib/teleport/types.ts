/**
 * Agent Teleportation data model.
 *
 * A Teleport is a lightweight, first-class record that ties together a
 * "primary" Televerse session (the user's existing in-flight work) and a
 * "child" session (the teleported investigation that runs in parallel
 * without disturbing the primary). The child reuses Televerse's existing
 * session infrastructure (sandbox spawn, Socket.io, whiteboard, replays)
 * but is given a `TeleportContext` system prompt so it knows it is a
 * scoped side-task specialist, not a fresh agent.
 *
 * The Teleport entity is the unit the WebMCP surface, REST API, and
 * UI all speak about. The actual computer-use execution lives on the
 * child session.
 */

export type TeleportStatus =
  | "created"
  | "context_captured"
  | "provisioning"
  | "running"
  | "investigating"
  | "testing"
  | "completed"
  | "failed"
  | "cancelled"
  | "reviewable"
  | "discarded";

export type ReturnMode = "report" | "report_and_patch" | "investigate_only";

export type ConfidenceLevel = "high" | "medium" | "low" | "unknown";

/**
 * Compact context packet the teleported agent receives in its system
 * prompt. Captures the minimum the side-task specialist needs to do
 * useful work without dragging the entire primary conversation.
 */
export interface TeleportContext {
  primarySessionId: string;
  primaryPrompt: string;
  primaryStatus: string;
  primaryStreamUrl?: string;
  recentTodos: Array<{ description: string; status: string; result?: string }>;
  recentWhiteboard: string;
  relevantFiles: string[];
  recentErrors: string[];
  constraints: string[];
  sideTask: string;
  returnMode: ReturnMode;
}

/**
 * Structured result the primary agent / human reviews. Designed to be
 * both human-readable (rendered in the UI) and machine-readable
 * (consumed by Codex via `retrieve_teleport_result`).
 */
export interface TeleportResult {
  summary: string;
  rootCause?: string;
  evidence: string[];
  filesInspected: string[];
  commandsExecuted: string[];
  testsExecuted: string[];
  patch?: {
    description: string;
    filesChanged: string[];
    diff: string;
  };
  recommendation: string;
  confidence: ConfidenceLevel;
}

export interface TeleportActivityEntry {
  timestamp: string;
  message: string;
  kind?: "open" | "command" | "finding" | "test" | "info" | "error";
}

export interface Teleport {
  id: string;
  userId: string;
  primarySessionId: string;
  /** Child session that the teleported agent is driving. */
  childSessionId: string;
  status: TeleportStatus;
  sideTask: string;
  returnMode: ReturnMode;
  context: TeleportContext;
  result?: TeleportResult;
  activity: TeleportActivityEntry[];
  patchApplied: boolean;
  patchDiscarded: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  errorMessage?: string;
}

export const TELEPORT_LIFECYCLE: TeleportStatus[] = [
  "created",
  "context_captured",
  "provisioning",
  "running",
  "investigating",
  "testing",
  "completed",
  "reviewable",
  "failed",
  "cancelled",
  "discarded",
];

export function isTerminalStatus(status: TeleportStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "discarded" ||
    status === "reviewable"
  );
}
