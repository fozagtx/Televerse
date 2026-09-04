import { describe, it, expect, beforeEach } from "vitest";
import {
  createTeleport,
  getTeleport,
  listTeleportsForUser,
  listTeleportsForPrimary,
  updateTeleportStatus,
  setTeleportResult,
  setTeleportError,
  cancelTeleport,
  markTeleportApplied,
  markTeleportDiscarded,
  appendActivity,
  ensureOwner,
} from "../store";
import type { TeleportContext } from "../types";

function makeContext(overrides?: Partial<TeleportContext>): TeleportContext {
  return {
    primarySessionId: "primary-1",
    primaryPrompt: "Build the checkout flow",
    primaryStatus: "running",
    recentTodos: [],
    recentWhiteboard: "",
    relevantFiles: [],
    recentErrors: ["HTTP 500 on /api/checkout"],
    constraints: [],
    sideTask: "Investigate the payment failure",
    returnMode: "report_and_patch",
    ...overrides,
  };
}

function makeInput(overrides?: Record<string, unknown>) {
  return {
    userId: "user-1",
    primarySessionId: "primary-1",
    sideTask: "Investigate the payment failure",
    returnMode: "report_and_patch" as const,
    context: makeContext(),
    childSessionId: "child-1",
    ...overrides,
  };
}

describe("teleport store", () => {
  beforeEach(() => {
    // Clear the underlying map in-place so the module-scoped reference stays valid.
    const globalStore = globalThis as unknown as {
      __opticon_teleports?: Map<string, unknown>;
    };
    if (globalStore.__opticon_teleports) {
      globalStore.__opticon_teleports.clear();
    }
  });

  it("creates a teleport with correct initial state", () => {
    const t = createTeleport(makeInput());
    expect(t.id).toBeTruthy();
    expect(t.status).toBe("created");
    expect(t.userId).toBe("user-1");
    expect(t.primarySessionId).toBe("primary-1");
    expect(t.childSessionId).toBe("child-1");
    expect(t.sideTask).toBe("Investigate the payment failure");
    expect(t.returnMode).toBe("report_and_patch");
    expect(t.patchApplied).toBe(false);
    expect(t.patchDiscarded).toBe(false);
    expect(t.activity.length).toBe(1);
    expect(t.activity[0].message).toContain("created");
  });

  it("getTeleport returns undefined for unknown id", () => {
    expect(getTeleport("nonexistent")).toBeUndefined();
  });

  it("getTeleport returns the teleport", () => {
    const t = createTeleport(makeInput());
    expect(getTeleport(t.id)).toBeDefined();
    expect(getTeleport(t.id)!.id).toBe(t.id);
  });

  it("listTeleportsForUser returns only matching user teleports", () => {
    createTeleport(makeInput({ userId: "user-1", childSessionId: "c1" }));
    createTeleport(makeInput({ userId: "user-2", childSessionId: "c2" }));
    createTeleport(makeInput({ userId: "user-1", childSessionId: "c3" }));

    const user1 = listTeleportsForUser("user-1");
    expect(user1.length).toBe(2);
    const user2 = listTeleportsForUser("user-2");
    expect(user2.length).toBe(1);
  });

  it("listTeleportsForPrimary filters by primary session", () => {
    createTeleport(makeInput({ primarySessionId: "p1", childSessionId: "c1" }));
    createTeleport(makeInput({ primarySessionId: "p2", childSessionId: "c2" }));
    createTeleport(makeInput({ primarySessionId: "p1", childSessionId: "c3" }));

    const p1 = listTeleportsForPrimary("p1", "user-1");
    expect(p1.length).toBe(2);
    const p2 = listTeleportsForPrimary("p2", "user-1");
    expect(p2.length).toBe(1);
  });

  it("updateTeleportStatus transitions correctly", () => {
    const t = createTeleport(makeInput());
    expect(t.status).toBe("created");

    updateTeleportStatus(t.id, "context_captured", "Context captured.");
    expect(getTeleport(t.id)!.status).toBe("context_captured");

    updateTeleportStatus(t.id, "running", "Agent running.");
    expect(getTeleport(t.id)!.status).toBe("running");

    // Terminal status sets completedAt
    updateTeleportStatus(t.id, "completed", "Done.");
    const updated = getTeleport(t.id)!;
    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toBeDefined();
  });

  it("setTeleportResult stores result and sets status", () => {
    const t = createTeleport(makeInput());
    setTeleportResult(t.id, {
      summary: "Found the bug: missing API key",
      rootCause: "Stripe client receives undefined API key",
      evidence: ["Reproduced error in browser console"],
      filesInspected: ["src/api/payment.ts"],
      commandsExecuted: ["curl localhost:3000/api/checkout"],
      testsExecuted: ["npm test"],
      patch: {
        description: "Add API key validation",
        filesChanged: ["src/api/payment.ts"],
        diff: "diff --git a/src/api/payment.ts b/src/api/payment.ts\n+const API_KEY = process.env.STRIPE_KEY",
      },
      recommendation: "Apply the patch and add env validation",
      confidence: "high",
    });

    const updated = getTeleport(t.id)!;
    expect(updated.status).toBe("reviewable");
    expect(updated.result).toBeDefined();
    expect(updated.result!.summary).toContain("missing API key");
    expect(updated.result!.patch).toBeDefined();
    expect(updated.result!.patch!.filesChanged).toContain("src/api/payment.ts");
    expect(updated.result!.confidence).toBe("high");
    expect(updated.completedAt).toBeDefined();
  });

  it("setTeleportError stores error and sets status to failed", () => {
    const t = createTeleport(makeInput());
    setTeleportError(t.id, "Sandbox failed to provision");
    const updated = getTeleport(t.id)!;
    expect(updated.status).toBe("failed");
    expect(updated.errorMessage).toBe("Sandbox failed to provision");
    expect(updated.completedAt).toBeDefined();
  });

  it("cancelTeleport sets status to cancelled", () => {
    const t = createTeleport(makeInput());
    cancelTeleport(t.id);
    const updated = getTeleport(t.id)!;
    expect(updated.status).toBe("cancelled");
    expect(updated.completedAt).toBeDefined();
  });

  it("cancelTeleport is a no-op on terminal teleports", () => {
    const t = createTeleport(makeInput());
    setTeleportError(t.id, "Something broke");
    cancelTeleport(t.id);
    expect(getTeleport(t.id)!.status).toBe("failed");
  });

  it("markTeleportApplied sets patchApplied and not discarded", () => {
    const t = createTeleport(makeInput());
    markTeleportApplied(t.id);
    const updated = getTeleport(t.id)!;
    expect(updated.patchApplied).toBe(true);
    expect(updated.patchDiscarded).toBe(false);
  });

  it("markTeleportDiscarded sets discarded status", () => {
    const t = createTeleport(makeInput());
    markTeleportDiscarded(t.id);
    const updated = getTeleport(t.id)!;
    expect(updated.status).toBe("discarded");
    expect(updated.patchDiscarded).toBe(true);
    expect(updated.completedAt).toBeDefined();
  });

  it("appendActivity adds an entry", () => {
    const t = createTeleport(makeInput());
    appendActivity(t.id, { message: "Testing something", kind: "test" });
    const updated = getTeleport(t.id)!;
    expect(updated.activity.length).toBe(2);
    expect(updated.activity[1].message).toBe("Testing something");
    expect(updated.activity[1].kind).toBe("test");
  });

  it("ensureOwner returns the teleport if owner matches", () => {
    const t = createTeleport(makeInput());
    expect(ensureOwner(t.id, "user-1")).toBeDefined();
    expect(ensureOwner("nonexistent", "user-1")).toBeUndefined();
  });

  it("ensureOwner returns undefined if owner mismatches", () => {
    const t = createTeleport(makeInput());
    expect(ensureOwner(t.id, "user-2")).toBeUndefined();
  });
});