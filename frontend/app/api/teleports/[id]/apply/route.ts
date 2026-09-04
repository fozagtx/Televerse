import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureOwner, getTeleport, markTeleportApplied } from "@/lib/teleport/store";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teleport = ensureOwner(id, "dev-user") ?? getTeleport(id);
  if (!teleport) {
    return NextResponse.json({ error: "Teleport not found" }, { status: 404 });
  }
  if (teleport.status !== "reviewable" && teleport.status !== "completed") {
    return NextResponse.json(
      { error: `Teleport is in '${teleport.status}' state. Only reviewable or completed teleports can have their patch applied.` },
      { status: 409 },
    );
  }
  if (!teleport.result?.patch) {
    return NextResponse.json(
      { error: "Teleport has no patch to apply." },
      { status: 409 },
    );
  }
  const updated = markTeleportApplied(id);
  return NextResponse.json({
    ok: true,
    message:
      "Patch marked as applied. Televerse does not auto-merge into the workspace; a human or the agent must perform the actual merge. Use this call as a coordination signal.",
    teleport: updated,
  });
}
