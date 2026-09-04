import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAndLaunchTeleport } from "@/lib/teleport/orchestrator";
import { listTeleportsForUser } from "@/lib/teleport/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    primarySessionId,
    sideTask,
    returnMode,
    relevantFiles,
    recentErrors,
    constraints,
    agentCount,
  } = body as {
    primarySessionId?: string;
    sideTask?: string;
    returnMode?: "report" | "report_and_patch" | "investigate_only";
    relevantFiles?: string[];
    recentErrors?: string[];
    constraints?: string[];
    agentCount?: number;
  };

  if (!primarySessionId) {
    return NextResponse.json(
      { error: "primarySessionId is required" },
      { status: 400 },
    );
  }
  if (!sideTask || typeof sideTask !== "string" || sideTask.trim().length === 0) {
    return NextResponse.json(
      { error: "sideTask is required" },
      { status: 400 },
    );
  }

  const outcome = await createAndLaunchTeleport({
    userId: "dev-user",
    primarySessionId,
    sideTask,
    returnMode,
    relevantFiles,
    recentErrors,
    constraints,
    agentCount,
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error },
      { status: outcome.status },
    );
  }

  return NextResponse.json(outcome, { status: 201 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const primarySessionId = url.searchParams.get("primarySessionId");
  const all = primarySessionId
    ? (await import("@/lib/teleport/store")).listTeleportsForPrimary(
        primarySessionId,
        "dev-user",
      )
    : listTeleportsForUser("dev-user");
  return NextResponse.json({ teleports: all });
}
