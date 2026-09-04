import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureOwner, getTeleport } from "@/lib/teleport/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teleport = ensureOwner(id, "dev-user") ?? getTeleport(id);
  if (!teleport) {
    return NextResponse.json({ error: "Teleport not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: teleport.id,
    primarySessionId: teleport.primarySessionId,
    childSessionId: teleport.childSessionId,
    status: teleport.status,
    sideTask: teleport.sideTask,
    returnMode: teleport.returnMode,
    activityCount: teleport.activity.length,
    hasResult: Boolean(teleport.result),
    errorMessage: teleport.errorMessage ?? null,
    createdAt: teleport.createdAt,
    updatedAt: teleport.updatedAt,
    completedAt: teleport.completedAt ?? null,
  });
}
