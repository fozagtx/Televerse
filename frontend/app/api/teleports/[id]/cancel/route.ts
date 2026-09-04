import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureOwner, getTeleport, cancelTeleport } from "@/lib/teleport/store";
import { getSession } from "@/lib/session-store";
import { killAllWorkers } from "@/lib/worker-manager";
import { persistSessionStatus } from "@/lib/db/session-persist";

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
  const updated = cancelTeleport(id);
  if (!updated) {
    return NextResponse.json({ error: "Failed to cancel teleport" }, { status: 500 });
  }
  // Kill the child session's workers
  try {
    killAllWorkers(teleport.childSessionId);
    persistSessionStatus(teleport.childSessionId, "cancelled").catch(() => {});
  } catch {
    // worker may not exist
  }
  const child = getSession(teleport.childSessionId);
  if (child) {
    child.status = "failed";
  }
  return NextResponse.json({ ok: true, teleport: updated });
}