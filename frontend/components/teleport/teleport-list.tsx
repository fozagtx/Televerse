"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Zap, ExternalLink, CheckCircle, XCircle, AlertCircle, Clock, ArrowRight } from "lucide-react";

interface TeleportSummary {
  id: string;
  status: string;
  sideTask: string;
  primarySessionId: string;
  childSessionId: string;
  returnMode: string;
  createdAt: number;
  patchApplied: boolean;
  patchDiscarded: boolean;
  errorMessage?: string;
}

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  context_captured: "Context Captured",
  provisioning: "Provisioning",
  running: "Running",
  investigating: "Investigating",
  testing: "Testing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  reviewable: "Ready for Review",
  discarded: "Discarded",
};

const STATUS_COLORS: Record<string, string> = {
  created: "bg-secondary text-secondary-foreground",
  context_captured: "bg-blue-100 text-blue-700",
  provisioning: "bg-blue-100 text-blue-700",
  running: "bg-green-100 text-green-700",
  investigating: "bg-amber-100 text-amber-700",
  testing: "bg-purple-100 text-purple-700",
  completed: "bg-secondary text-secondary-foreground",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-secondary text-muted-foreground",
  reviewable: "bg-emerald-100 text-emerald-700",
  discarded: "bg-secondary text-muted-foreground",
};

function statusIcon(status: string) {
  switch (status) {
    case "running":
    case "investigating":
    case "testing":
    case "provisioning":
      return <Clock className="size-3.5" />;
    case "completed":
    case "reviewable":
      return <CheckCircle className="size-3.5" />;
    case "failed":
    case "cancelled":
    case "discarded":
      return <XCircle className="size-3.5" />;
    default:
      return <AlertCircle className="size-3.5" />;
  }
}

interface TeleportListProps {
  primarySessionId?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}

export function TeleportList({ primarySessionId, onSelect, compact = false }: TeleportListProps) {
  const [teleports, setTeleports] = useState<TeleportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function loadTeleports() {
      try {
        const qs = primarySessionId ? `?primarySessionId=${encodeURIComponent(primarySessionId)}` : "";
        const res = await globalThis.fetch(`/api/teleports${qs}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setTeleports(data.teleports);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTeleports();
    return () => { cancelled = true; };
  }, [primarySessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-4 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (teleports.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-muted-foreground">
        No teleported agents yet. Use the Teleport modal to delegate a side task.
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {teleports.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            if (onSelect) onSelect(t.id);
            else router.push(`/teleport/${t.id}`);
          }}
          className={`w-full text-left rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors ${
            compact ? "p-2" : "p-3"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground truncate">
                  {t.sideTask}
                </span>
                {t.patchApplied && (
                  <span className="text-[10px] text-emerald-400 whitespace-nowrap">Applied</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{new Date(t.createdAt).toLocaleString()}</span>
                <span>·</span>
                <span>{t.returnMode}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] ${STATUS_COLORS[t.status] ?? "bg-secondary text-muted-foreground"}`}>
              {statusIcon(t.status)}
              <span>{STATUS_LABELS[t.status] ?? t.status}</span>
            </div>
          </div>
          {!compact && t.errorMessage && (
            <p className="mt-1.5 text-[10px] text-red-400 truncate">{t.errorMessage}</p>
          )}
        </button>
      ))}
    </div>
  );
}

interface TeleportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primarySessionId: string;
  onCreated?: (teleportId: string) => void;
}

export function TeleportModal({ open, onOpenChange, primarySessionId, onCreated }: TeleportModalProps) {
  const [task, setTask] = useState("");
  const [returnMode, setReturnMode] = useState<"report" | "report_and_patch" | "investigate_only">("report");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ teleportId: string; childWatchUrl: string } | null>(null);
  const router = useRouter();

  if (!open) return null;

  async function handleSubmit() {
    if (!task.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/teleports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primarySessionId,
          sideTask: task.trim(),
          returnMode,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create teleport");
      }
      const data = await res.json();
      setResult({ teleportId: data.teleportId, childWatchUrl: data.childWatchUrl });
      if (onCreated) onCreated(data.teleportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="size-5" />
              <h3 className="text-sm font-semibold">Teleport launched</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              An agent is now investigating in an isolated workspace. Your session is not interrupted.
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Teleport ID</div>
              <div className="mt-1 font-mono text-xs text-foreground">{result.teleportId}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  router.push(`/teleport/${result.teleportId}`);
                  onOpenChange(false);
                }}
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                View Teleport
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setTask("");
                  onOpenChange(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Teleport Agent</h3>
            </div>
            <p className="text-xs text-zinc-500">
              Delegate a side task to an isolated computer-use agent. Your current agent continues uninterrupted.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400">What should it investigate?</label>
              <Textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Check why the checkout API is returning 500..."
                className="min-h-[100px] resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400">Return:</span>
              <div className="flex gap-1">
                {(["report", "report_and_patch", "investigate_only"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setReturnMode(mode)}
                    className={`rounded-full px-2.5 py-1 text-[10px] transition-all ${
                      returnMode === mode
                        ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {mode === "report" ? "Report" : mode === "report_and_patch" ? "Report + Patch" : "Investigate Only"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/40 p-2 text-[11px] text-red-300">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !task.trim()}
                className="gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Zap className="size-3.5" />
                )}
                {submitting ? "Launching…" : "Teleport"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}