import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureOwner, getTeleport, markTeleportDiscarded } from "@/lib/teleport/store";

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
  const updated = markTeleportDiscarded(id);
  return NextResponse.json({ ok: true, teleport: updated });
}
