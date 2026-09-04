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
    status: teleport.status,
    sideTask: teleport.sideTask,
    returnMode: teleport.returnMode,
    result: teleport.result ?? null,
    activity: teleport.activity,
    patchApplied: teleport.patchApplied,
    patchDiscarded: teleport.patchDiscarded,
    errorMessage: teleport.errorMessage ?? null,
    childSessionId: teleport.childSessionId,
    primarySessionId: teleport.primarySessionId,
  });
}
