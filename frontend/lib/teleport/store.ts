/**
 * In-memory Teleport store. Mirrors the pattern used by `session-store.ts`:
 * a global Map so it survives Next.js hot reloads in dev.
 *
 * For a production deployment this would be backed by Postgres alongside
 * the session table. The store intentionally keeps the surface small so
 * it is straightforward to swap the implementation later.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  Teleport,
  TeleportActivityEntry,
  TeleportContext,
  TeleportResult,
  TeleportStatus,
} from "./types";
import { isTerminalStatus } from "./types";

const globalStore = globalThis as unknown as {
  __opticon_teleports?: Map<string, Teleport>;
};

const teleports =
  globalStore.__opticon_teleports ??= new Map<string, Teleport>();

export interface CreateTeleportInput {
  userId: string;
  primarySessionId: string;
  sideTask: string;
  returnMode?: TeleportContext["returnMode"];
  context: Omit<TeleportContext, "sideTask" | "returnMode">;
  childSessionId: string;
}

export function createTeleport(input: CreateTeleportInput): Teleport {
  const now = Date.now();
  const teleport: Teleport = {
    id: uuidv4(),
    userId: input.userId,
    primarySessionId: input.primarySessionId,
    childSessionId: input.childSessionId,
    status: "created",
    sideTask: input.sideTask.trim(),
    returnMode: input.returnMode ?? "report",
    context: {
      ...input.context,
      sideTask: input.sideTask.trim(),
      returnMode: input.returnMode ?? "report",
    },
    activity: [
      {
        timestamp: new Date(now).toISOString(),
        message: "Teleport created.",
        kind: "info",
      },
    ],
    patchApplied: false,
    patchDiscarded: false,
    createdAt: now,
    updatedAt: now,
  };
  teleports.set(teleport.id, teleport);
  return teleport;
}

export function getTeleport(id: string): Teleport | undefined {
  return teleports.get(id);
}

export function listTeleportsForUser(userId: string): Teleport[] {
  const out: Teleport[] = [];
  for (const t of teleports.values()) {
    if (t.userId === userId) out.push(t);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function listTeleportsForPrimary(
  primarySessionId: string,
  userId: string,
): Teleport[] {
  const out: Teleport[] = [];
  for (const t of teleports.values()) {
    if (t.userId === userId && t.primarySessionId === primarySessionId) {
      out.push(t);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function updateTeleportStatus(
  id: string,
  status: TeleportStatus,
  message?: string,
): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  if (t.status === status) return t;
  t.status = status;
  t.updatedAt = Date.now();
  if (isTerminalStatus(status) && !t.completedAt) {
    t.completedAt = t.updatedAt;
  }
  if (message) {
    pushActivityInternal(t, { message, kind: "info" });
  }
  return t;
}

export function appendActivity(
  id: string,
  entry: Omit<TeleportActivityEntry, "timestamp">,
): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  pushActivityInternal(t, entry);
  return t;
}

function pushActivityInternal(
  t: Teleport,
  entry: Omit<TeleportActivityEntry, "timestamp">,
): void {
  t.activity.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  // Cap to a sane in-memory size.
  if (t.activity.length > 200) {
    t.activity.splice(0, t.activity.length - 200);
  }
  t.updatedAt = Date.now();
}

export function setTeleportResult(
  id: string,
  result: TeleportResult,
  finalStatus: "completed" | "reviewable" = "reviewable",
): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  t.result = result;
  t.status = finalStatus;
  t.updatedAt = Date.now();
  t.completedAt = t.updatedAt;
  pushActivityInternal(t, {
    message: `Investigation complete: ${result.summary}`,
    kind: "finding",
  });
  return t;
}

export function setTeleportError(
  id: string,
  error: string,
): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  t.status = "failed";
  t.errorMessage = error;
  t.updatedAt = Date.now();
  t.completedAt = t.updatedAt;
  pushActivityInternal(t, { message: `Failed: ${error}`, kind: "error" });
  return t;
}

export function markTeleportApplied(id: string): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  t.patchApplied = true;
  t.patchDiscarded = false;
  t.updatedAt = Date.now();
  pushActivityInternal(t, {
    message: "Patch applied to primary workspace.",
    kind: "info",
  });
  return t;
}

export function markTeleportDiscarded(id: string): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  t.patchDiscarded = true;
  t.status = "discarded";
  t.updatedAt = Date.now();
  t.completedAt = t.updatedAt;
  pushActivityInternal(t, {
    message: "Patch discarded. Workspace cleaned up.",
    kind: "info",
  });
  return t;
}

export function cancelTeleport(id: string): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  if (isTerminalStatus(t.status)) return t;
  t.status = "cancelled";
  t.updatedAt = Date.now();
  t.completedAt = t.updatedAt;
  pushActivityInternal(t, {
    message: "Teleport cancelled by user.",
    kind: "info",
  });
  return t;
}

export function ensureOwner(id: string, userId: string): Teleport | undefined {
  const t = teleports.get(id);
  if (!t) return undefined;
  if (t.userId !== userId) return undefined;
  return t;
}
