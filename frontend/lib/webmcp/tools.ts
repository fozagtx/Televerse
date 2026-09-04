/**
 * WebMCP tool surface for Agent Teleportation.
 *
 * These are the ONLY tools exposed to agents. Intentionally small and
 * high-level — agents should not be driving raw computer-use primitives;
 * they delegate a side task to Televerse and Televerse runs the computer-use
 * agent in an isolated workspace.
 *
 * The five tools map 1:1 to the teleport lifecycle:
 *   teleport_agent           -> create a teleport (return a job id)
 *   list_teleports           -> see all teleports for a session/user
 *   get_teleport_status      -> poll lifecycle + activity
 *   retrieve_teleport_result -> structured findings + optional patch
 *   apply_teleport_patch     -> coordinate the merge (human/primary applies)
 *   discard_teleport         -> drop the workspace/result
 *   cancel_teleport          -> abort an in-flight teleport
 */

import type { ToolDefinition } from "./types";
import type { TeleportStatus, ReturnMode, ConfidenceLevel } from "@/lib/teleport/types";

export type { ToolDefinition } from "./types";

const RETURN_MODES: ReturnMode[] = ["report", "report_and_patch", "investigate_only"];

const TELEPORT_STATUSES: TeleportStatus[] = [
  "created",
  "context_captured",
  "provisioning",
  "running",
  "investigating",
  "testing",
  "completed",
  "failed",
  "cancelled",
  "reviewable",
  "discarded",
];

const CONFIDENCE: ConfidenceLevel[] = ["high", "medium", "low", "unknown"];

/** Bivariant execute that narrows `rawArgs`. */
type Execute = (raw: unknown, opts: { signal: AbortSignal }) => Promise<unknown>;

const j = (obj: unknown) => JSON.stringify(obj, null, 2);

export const teleportAgentTool: ToolDefinition<{
  primarySessionId: string;
  task: string;
  returnMode?: ReturnMode;
  relevantFiles?: string[];
  recentErrors?: string[];
  constraints?: string[];
  agentCount?: number;
}> = {
  name: "teleport_agent",
  description:
    "Use this when a side investigation, debugging task, research task, browser task, test investigation, or other secondary task would interrupt the user's primary coding workflow. Teleports a temporary computer-use agent into an isolated Televerse workspace. The teleported agent receives context from the primary session, works independently, and returns structured findings (and optionally a patch). Your primary session continues running uninterrupted. Returns a stable teleport ID to track with get_teleport_status and retrieve_teleport_result.",
  inputSchema: {
    type: "object",
    required: ["primarySessionId", "task"],
    properties: {
      primarySessionId: {
        type: "string",
        description:
          "The Televerse session id of the user's primary task. Context is captured from this session and the teleported agent is isolated from it.",
      },
      task: {
        type: "string",
        minLength: 1,
        description:
          "The side task for the teleported agent to investigate. Be specific: what to reproduce, what to inspect, what the expected behavior is.",
      },
      returnMode: {
        type: "string",
        enum: RETURN_MODES,
        description:
          "What the teleported agent should return. 'report' (default) = findings only. 'report_and_patch' = also prepare a patch for review. 'investigate_only' = read/reproduce, no modifications.",
      },
      relevantFiles: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional file paths (relative to the primary project) relevant to the side task, to seed context.",
      },
      recentErrors: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional error messages the user/primary agent recently observed.",
      },
      constraints: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional guardrails for the teleported agent (e.g. 'do not install packages').",
      },
      agentCount: {
        type: "integer",
        minimum: 1,
        maximum: 2,
        description: "Agents for this teleport. Default 1.",
      },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as {
      primarySessionId?: string;
      task?: string;
      returnMode?: ReturnMode;
      relevantFiles?: string[];
      recentErrors?: string[];
      constraints?: string[];
      agentCount?: number;
    };
    if (!a.primarySessionId) throw new Error("primarySessionId is required.");
    if (!a.task || !a.task.trim()) throw new Error("task is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{
      ok: true;
      teleportId: string;
      childSessionId: string;
      primarySessionId: string;
      status: string;
      watchUrl: string;
      childWatchUrl: string;
    }>("/api/teleports", {
      method: "POST",
      body: {
        primarySessionId: a.primarySessionId,
        sideTask: a.task,
        returnMode: a.returnMode,
        relevantFiles: a.relevantFiles,
        recentErrors: a.recentErrors,
        constraints: a.constraints,
        agentCount: a.agentCount,
      },
      signal,
    });
    return renderToolResult({
      teleportId: data.teleportId,
      status: data.status,
      childSessionId: data.childSessionId,
      primarySessionId: data.primarySessionId,
      watchUrl: data.watchUrl,
      message:
        "Teleport created. Poll get_teleport_status with the teleportId to monitor progress, then retrieve_teleport_result when it is reviewable.",
    });
  }) as Execute,
};

export const listTeleportsTool: ToolDefinition<{
  primarySessionId?: string;
}> = {
  name: "list_teleports",
  description:
    "List the current user's teleports, newest first. Optionally filter to teleports spawned from a specific primary session id.",
  inputSchema: {
    type: "object",
    properties: {
      primarySessionId: {
        type: "string",
        description:
          "Optional. Only return teleports whose primary session matches this id.",
      },
    },
  },
  annotations: { readOnlyHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { primarySessionId?: string };
    const qs = a.primarySessionId
      ? `?primarySessionId=${encodeURIComponent(a.primarySessionId)}`
      : "";
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{
      teleports: Array<{
        id: string;
        status: TeleportStatus;
        sideTask: string;
        primarySessionId: string;
        childSessionId: string;
        returnMode: ReturnMode;
        createdAt: number;
        patchApplied: boolean;
        patchDiscarded: boolean;
      }>;
    }>(`/api/teleports${qs}`, { signal });
    return renderToolResult(
      data.teleports.map((t) => ({
        id: t.id,
        status: t.status,
        sideTask: t.sideTask,
        primarySessionId: t.primarySessionId,
        returnMode: t.returnMode,
        createdAt: new Date(t.createdAt).toISOString(),
        patchApplied: t.patchApplied,
        patchDiscarded: t.patchDiscarded,
      })),
    );
  }) as Execute,
};

export const getTeleportStatusTool: ToolDefinition<{ teleportId: string }> = {
  name: "get_teleport_status",
  description:
    "Fetch the live status of a teleport. Returns lifecycle phase, a short progress description, and the activity log. Poll this while a teleport is running. Terminal states are completed, reviewable, failed, cancelled, and discarded.",
  inputSchema: {
    type: "object",
    required: ["teleportId"],
    properties: {
      teleportId: { type: "string", description: "The teleport ID from teleport_agent." },
    },
  },
  annotations: { readOnlyHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { teleportId?: string };
    if (!a.teleportId) throw new Error("teleportId is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{
      id: string;
      status: string;
      primarySessionId: string;
      childSessionId: string;
      sideTask: string;
      returnMode: string;
      activityCount: number;
      hasResult: boolean;
      errorMessage: string | null;
      createdAt: number;
      updatedAt: number;
      completedAt: number | null;
    }>(`/api/teleports/${a.teleportId}/status`, { signal });
    return renderToolResult({
      teleportId: data.id,
      status: data.status,
      sideTask: data.sideTask,
      returnMode: data.returnMode,
      primarySessionId: data.primarySessionId,
      childSessionId: data.childSessionId,
      activityCount: data.activityCount,
      hasResult: data.hasResult,
      errorMessage: data.errorMessage,
      createdAt: new Date(data.createdAt).toISOString(),
      updatedAt: new Date(data.updatedAt).toISOString(),
      completedAt: data.completedAt ? new Date(data.completedAt).toISOString() : null,
    });
  }) as Execute,
};

export const retrieveTeleportResultTool: ToolDefinition<{ teleportId: string }> = {
  name: "retrieve_teleport_result",
  description:
    "Retrieve the structured result of a completed or reviewable teleport. Returns summary, root cause, evidence, files inspected, commands/tests executed, an optional patch (description, files changed, diff), recommendation, and confidence. Consume this to review and decide whether to apply the patch.",
  inputSchema: {
    type: "object",
    required: ["teleportId"],
    properties: {
      teleportId: { type: "string", description: "The teleport ID from teleport_agent." },
    },
  },
  annotations: { readOnlyHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { teleportId?: string };
    if (!a.teleportId) throw new Error("teleportId is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{
      id: string;
      status: string;
      sideTask: string;
      result: {
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
        confidence: string;
      } | null;
      activity: Array<{ timestamp: string; message: string; kind?: string }>;
      errorMessage: string | null;
    }>(`/api/teleports/${a.teleportId}/result`, { signal });
    if (!data.result) {
      return renderToolResult({
        teleportId: data.id,
        status: data.status,
        errorMessage: data.errorMessage,
        message:
          data.status === "completed" || data.status === "reviewable"
            ? "Result is not yet populated."
            : "Teleport has not finished yet. Poll get_teleport_status.",
      });
    }
    return renderToolResult({
      teleportId: data.id,
      status: data.status,
      result: data.result,
    });
  }) as Execute,
};

export const applyTeleportPatchTool: ToolDefinition<{ teleportId: string }> = {
  name: "apply_teleport_patch",
  description:
    "Coordinate applying a completed teleport's patch. Televerse never auto-merges into the primary workspace — it marks the patch as applied so the primary agent/human knows it's been reviewed. Only call after retrieve_teleport_result shows a reviewable status. Returns a coordination acknowledgement; the actual merge is the caller's responsibility.",
  inputSchema: {
    type: "object",
    required: ["teleportId"],
    properties: {
      teleportId: { type: "string", description: "The teleport ID." },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { teleportId?: string };
    if (!a.teleportId) throw new Error("teleportId is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{ ok: boolean; message: string }>(
      `/api/teleports/${a.teleportId}/apply`,
      { method: "POST", body: {}, signal },
    );
    return renderToolResult(data);
  }) as Execute,
};

export const discardTeleportTool: ToolDefinition<{ teleportId: string }> = {
  name: "discard_teleport",
  description:
    "Discard a teleport and its result. Marks the teleport as discarded and cleans up its workspace. Idempotent — safe to call after a teleport is already terminal.",
  inputSchema: {
    type: "object",
    required: ["teleportId"],
    properties: {
      teleportId: { type: "string", description: "The teleport ID." },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { teleportId?: string };
    if (!a.teleportId) throw new Error("teleportId is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{ ok: boolean }>(
      `/api/teleports/${a.teleportId}/discard`,
      { method: "POST", body: {}, signal },
    );
    return renderToolResult(data);
  }) as Execute,
};

export const cancelTeleportTool: ToolDefinition<{ teleportId: string }> = {
  name: "cancel_teleport",
  description:
    "Cancel an in-flight teleport. Aborts the teleported agent's workers and marks the teleport as cancelled. No result is produced. Use when the side task is no longer needed.",
  inputSchema: {
    type: "object",
    required: ["teleportId"],
    properties: {
      teleportId: { type: "string", description: "The teleport ID." },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
  execute: (async (raw, { signal }) => {
    const a = (raw ?? {}) as { teleportId?: string };
    if (!a.teleportId) throw new Error("teleportId is required.");
    const { opticonFetch, renderToolResult } = await import("./api-client");
    const data = await opticonFetch<{ ok: boolean }>(
      `/api/teleports/${a.teleportId}/cancel`,
      { method: "POST", body: {}, signal },
    );
    return renderToolResult(data);
  }) as Execute,
};

export const allTools: ToolDefinition[] = [
  teleportAgentTool,
  listTeleportsTool,
  getTeleportStatusTool,
  retrieveTeleportResultTool,
  applyTeleportPatchTool,
  discardTeleportTool,
  cancelTeleportTool,
];

export const TELEPORT_TOOL_NAMES = allTools.map((t) => t.name);

// Re-export for convenience/testing
export { TELEPORT_STATUSES, RETURN_MODES, CONFIDENCE };
