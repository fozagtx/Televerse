/**
 * Context-capture for Agent Teleportation.
 *
 * Given the primary session the user is currently running, build the
 * compact `TeleportContext` packet the teleported agent will receive
 * in its system prompt. Designed to be a *small* description of the
 * primary task — enough to ground a side-task specialist without
 * copying the full conversation.
 */

import { getSession } from "@/lib/session-store";
import type { Session } from "@/lib/types";
import type { TeleportContext } from "./types";

export interface CaptureInput {
  primarySessionId: string;
  sideTask: string;
  returnMode: TeleportContext["returnMode"];
  /** Optional explicit context overrides from the user / calling agent. */
  relevantFiles?: string[];
  recentErrors?: string[];
  constraints?: string[];
}

const RECENT_TODO_LIMIT = 8;
const WHITEBOARD_PREVIEW_CHARS = 2000;

export function captureContext(
  input: CaptureInput,
): TeleportContext | { error: string } {
  const session = getSession(input.primarySessionId);
  if (!session) {
    return { error: `Primary session ${input.primarySessionId} not found.` };
  }

  const recentTodos = session.todos
    .slice(-RECENT_TODO_LIMIT)
    .map((t) => ({
      description: t.description,
      status: t.status,
      result: t.result,
    }));

  return {
    primarySessionId: session.id,
    primaryPrompt: session.prompt,
    primaryStatus: session.status,
    primaryStreamUrl: session.agents.find((a) => a.streamUrl)?.streamUrl,
    recentTodos,
    recentWhiteboard: (session.whiteboard ?? "").slice(
      -WHITEBOARD_PREVIEW_CHARS,
    ),
    relevantFiles: input.relevantFiles ?? [],
    recentErrors: input.recentErrors ?? [],
    constraints: input.constraints ?? [
      "Do not modify files in the primary session's working area.",
      "Work only inside the teleported isolated environment.",
      "If you need to read or run something from the primary, request it explicitly via the agent's tools — do not assume shared state.",
    ],
    sideTask: input.sideTask.trim(),
    returnMode: input.returnMode,
  };
}

/**
 * Format the TeleportContext as a system-prompt fragment the worker
 * can read on its first turn. Kept in plain text so it composes with
 * the existing worker.py `SYSTEM_PROMPT` without changes.
 */
export function formatContextForPrompt(ctx: TeleportContext): string {
  const lines: string[] = [];
  lines.push("## TELEPORT MISSION");
  lines.push(
    "You are a temporary specialist spawned from another Televerse session. Solve the side task below without interfering with the primary agent.",
  );
  lines.push("");
  lines.push("### Primary session");
  lines.push(`- id: ${ctx.primarySessionId}`);
  lines.push(`- status: ${ctx.primaryStatus}`);
  lines.push(`- prompt: ${ctx.primaryPrompt}`);
  if (ctx.primaryStreamUrl) {
    lines.push(`- stream: ${ctx.primaryStreamUrl}`);
  }
  lines.push("");
  lines.push("### Primary todos (recent)");
  for (const t of ctx.recentTodos) {
    lines.push(`- [${t.status}] ${t.description}`);
  }
  lines.push("");
  if (ctx.recentWhiteboard.trim()) {
    lines.push("### Primary whiteboard (recent)");
    lines.push(ctx.recentWhiteboard);
    lines.push("");
  }
  if (ctx.relevantFiles.length > 0) {
    lines.push("### Files relevant to the side task");
    for (const f of ctx.relevantFiles) lines.push(`- ${f}`);
    lines.push("");
  }
  if (ctx.recentErrors.length > 0) {
    lines.push("### Recent errors observed by the primary");
    for (const e of ctx.recentErrors) lines.push(`- ${e}`);
    lines.push("");
  }
  if (ctx.constraints.length > 0) {
    lines.push("### Constraints");
    for (const c of ctx.constraints) lines.push(`- ${c}`);
    lines.push("");
  }
  lines.push("### Side task");
  lines.push(ctx.sideTask);
  lines.push("");
  lines.push(`### Return mode: ${ctx.returnMode}`);
  if (ctx.returnMode === "report") {
    lines.push(
      "Return a written report only. Do not modify files or run tests beyond what is needed to confirm the diagnosis.",
    );
  } else if (ctx.returnMode === "report_and_patch") {
    lines.push(
      "Investigate, then prepare a patch in your isolated workspace. The primary agent or user will review before applying.",
    );
  } else {
    lines.push(
      "Investigate only. Read code, browse, and reproduce. Do not modify anything.",
    );
  }
  return lines.join("\n");
}

export function isSession(
  value: Session | undefined,
): value is Session {
  return value !== undefined;
}
