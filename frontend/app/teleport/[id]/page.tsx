"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ExternalLink, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Terminal, FileText, Bug, TestTube } from "lucide-react";

interface TeleportDetail {
  id: string;
  status: string;
  sideTask: string;
  returnMode: string;
  primarySessionId: string;
  childSessionId: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  patchApplied: boolean;
  patchDiscarded: boolean;
  errorMessage?: string;
  context: {
    primaryPrompt: string;
    primaryStatus: string;
    relevantFiles: string[];
    recentErrors: string[];
    constraints: string[];
  };
  result?: {
    summary: string;
    rootCause?: string;
    evidence: string[];
    filesInspected: string[];
    commandsExecuted: string[];
    testsExecuted: string[];
    patch?: {
      description: string;
      filesChanged: string[];
      diff: string;
    };
    recommendation: string;
    confidence: string;
  };
  activity: Array<{
    timestamp: string;
    message: string;
    kind?: string;
  }>;
}

const STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: { label: "Created", color: "bg-secondary text-foreground", icon: <Clock className="size-3.5" /> },
  context_captured: { label: "Context Captured", color: "bg-blue-900/50 text-blue-300", icon: <FileText className="size-3.5" /> },
  provisioning: { label: "Provisioning", color: "bg-blue-900/50 text-blue-300", icon: <Loader2 className="size-3.5 animate-spin" /> },
  running: { label: "Running", color: "bg-green-900/50 text-green-300", icon: <Terminal className="size-3.5" /> },
  investigating: { label: "Investigating", color: "bg-amber-900/50 text-amber-300", icon: <Bug className="size-3.5" /> },
  testing: { label: "Testing", color: "bg-purple-900/50 text-purple-300", icon: <TestTube className="size-3.5" /> },
  completed: { label: "Completed", color: "bg-secondary text-foreground", icon: <CheckCircle className="size-3.5" /> },
  failed: { label: "Failed", color: "bg-red-900/50 text-red-300", icon: <XCircle className="size-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-secondary text-foreground", icon: <XCircle className="size-3.5" /> },
  reviewable: { label: "Ready for Review", color: "bg-emerald-900/50 text-emerald-300", icon: <CheckCircle className="size-3.5" /> },
  discarded: { label: "Discarded", color: "bg-secondary text-foreground", icon: <XCircle className="size-3.5" /> },
};

export default function TeleportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teleportId = params.id as string;

  const [teleport, setTeleport] = useState<TeleportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const fetchTeleport = useCallback(async () => {
    try {
      const res = await fetch(`/api/teleports/${teleportId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTeleport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [teleportId]);

  useEffect(() => {
    fetchTeleport();
  }, [fetchTeleport]);

  // Poll while running
  useEffect(() => {
    if (!teleport) return;
    const terminal = ["completed", "reviewable", "failed", "cancelled", "discarded"];
    if (terminal.includes(teleport.status)) return;
    const interval = setInterval(fetchTeleport, 3000);
    return () => clearInterval(interval);
  }, [teleport, fetchTeleport]);

  const handleAction = async (action: string, method: string) => {
    setActionLoading(action);
    try {
      await fetch(`/api/teleports/${teleportId}/${action}`, { method });
      await fetchTeleport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-foreground" />
      </div>
    );
  }

  if (error || !teleport) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-foreground">{error || "Teleport not found"}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          Return home
        </Button>
      </div>
    );
  }

  const badge = STATUS_BADGES[teleport.status] ?? { label: teleport.status, color: "bg-secondary text-foreground", icon: null };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-1 text-xs text-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-amber-400 shrink-0" />
              <h1 className="text-lg font-semibold text-foreground truncate">{teleport.sideTask}</h1>
            </div>
            <p className="mt-1 text-xs text-foreground">
              Teleport from{" "}
              <button
                onClick={() => router.push(`/session/${teleport.primarySessionId}`)}
                className="font-mono text-foreground underline hover:text-foreground"
              >
                {teleport.primarySessionId.slice(0, 8)}
              </button>
              {" · "}
              <span>{teleport.returnMode.replace(/_/g, " ")}</span>
              {" · "}
              <span>{new Date(teleport.createdAt).toLocaleString()}</span>
            </p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${badge.color}`}>
            {badge.icon}
            <span>{badge.label}</span>
          </div>
        </div>
      </div>

      {teleport.errorMessage && (
        <div className="mb-6 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
          {teleport.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: activity + evidence */}
        <div className="space-y-6 lg:col-span-2">
          {/* Activity */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">Activity</h2>
            <div className="space-y-1">
              {teleport.activity.length === 0 ? (
                <p className="text-xs text-foreground">No activity yet.</p>
              ) : (
                teleport.activity.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
                      entry.kind === "error"
                        ? "bg-red-950/30 text-red-300"
                        : entry.kind === "finding"
                          ? "bg-amber-950/30 text-amber-300"
                          : "bg-secondary/40 text-foreground"
                    }`}
                  >
                    <span className="shrink-0 font-mono text-[10px] text-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span>{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Result */}
          {teleport.result && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">Result</h2>
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-secondary/60 p-4">
                  <p className="text-sm text-foreground">{teleport.result.summary}</p>
                  {teleport.result.rootCause && (
                    <div className="mt-3">
                      <span className="text-[10px] uppercase tracking-wide text-foreground">Root Cause</span>
                      <p className="mt-1 text-xs text-foreground">{teleport.result.rootCause}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-foreground">Confidence</span>
                    <span className={`text-xs font-medium ${
                      teleport.result.confidence === "high" ? "text-emerald-400" :
                      teleport.result.confidence === "medium" ? "text-amber-400" : "text-foreground"
                    }`}>
                      {teleport.result.confidence}
                    </span>
                    <span className="text-foreground">·</span>
                    <span className="text-[10px] text-foreground">Recommendation</span>
                    <span className="text-xs text-foreground">{teleport.result.recommendation}</span>
                  </div>
                </div>

                {teleport.result.evidence.length > 0 && (
                  <div className="rounded-lg border border-border bg-secondary/60 p-4">
                    <h3 className="mb-2 text-[10px] uppercase tracking-wide text-foreground">Evidence</h3>
                    <ul className="space-y-1">
                      {teleport.result.evidence.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-secondary" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-secondary/60 p-4">
                    <h3 className="mb-2 text-[10px] uppercase tracking-wide text-foreground">Files Inspected</h3>
                    {teleport.result.filesInspected.length > 0 ? (
                      <ul className="space-y-0.5">
                        {teleport.result.filesInspected.map((f, i) => (
                          <li key={i} className="font-mono text-[11px] text-foreground">{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-foreground">None</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/60 p-4">
                    <h3 className="mb-2 text-[10px] uppercase tracking-wide text-foreground">Commands & Tests</h3>
                    {teleport.result.commandsExecuted.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] text-foreground">Commands</p>
                        <ul className="space-y-0.5">
                          {teleport.result.commandsExecuted.map((c, i) => (
                            <li key={i} className="font-mono text-[11px] text-foreground">{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {teleport.result.testsExecuted.length > 0 && (
                      <div>
                        <p className="text-[10px] text-foreground">Tests</p>
                        <ul className="space-y-0.5">
                          {teleport.result.testsExecuted.map((t, i) => (
                            <li key={i} className="font-mono text-[11px] text-foreground">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {teleport.result.commandsExecuted.length === 0 && teleport.result.testsExecuted.length === 0 && (
                      <p className="text-xs text-foreground">None</p>
                    )}
                  </div>
                </div>

                {teleport.result.patch && (
                  <div className="rounded-lg border border-border bg-secondary/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] uppercase tracking-wide text-foreground">Patch</h3>
                      <button
                        onClick={() => setShowDiff(!showDiff)}
                        className="text-[10px] text-foreground hover:text-foreground"
                      >
                        {showDiff ? "Hide diff" : "Show diff"}
                      </button>
                    </div>
                    <p className="text-xs text-foreground">{teleport.result.patch.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {teleport.result.patch.filesChanged.map((f, i) => (
                        <span key={i} className="font-mono text-[10px] text-foreground bg-secondary/50 rounded px-1.5 py-0.5">{f}</span>
                      ))}
                    </div>
                    {showDiff && teleport.result.patch.diff && (
                      <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-secondary p-2 text-[11px] text-foreground">
                        {teleport.result.patch.diff}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right: actions + context */}
        <div className="space-y-4">
          {/* Actions */}
          <section className="rounded-lg border border-border bg-secondary/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">Actions</h2>
            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => router.push(`/session/${teleport.childSessionId}`)}
              >
                <ExternalLink className="size-3.5" />
                Watch Teleport Session
              </Button>
              {teleport.status === "reviewable" && teleport.result?.patch && !teleport.patchApplied && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start gap-2 text-emerald-400"
                  onClick={() => handleAction("apply", "POST")}
                  disabled={actionLoading === "apply"}
                >
                  {actionLoading === "apply" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                  {actionLoading === "apply" ? "Applying…" : "Apply Patch"}
                </Button>
              )}
              {!["discarded", "cancelled", "failed"].includes(teleport.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start gap-2 text-red-400 hover:text-red-300"
                  onClick={() => handleAction("cancel", "POST")}
                  disabled={actionLoading === "cancel"}
                >
                  {actionLoading === "cancel" ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  Cancel Teleport
                </Button>
              )}
              {!["discarded"].includes(teleport.status) && (teleport.status === "reviewable" || teleport.status === "completed") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start gap-2 text-foreground"
                  onClick={() => handleAction("discard", "POST")}
                  disabled={actionLoading === "discard"}
                >
                  {actionLoading === "discard" ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  Discard
                </Button>
              )}
            </div>
          </section>

          {/* Context */}
          <section className="rounded-lg border border-border bg-secondary/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">Captured Context</h2>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-foreground">Primary status:</span>{" "}
                <span className="text-foreground">{teleport.context.primaryStatus}</span>
              </div>
              {teleport.context.relevantFiles.length > 0 && (
                <div>
                  <span className="text-foreground">Relevant files:</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {teleport.context.relevantFiles.map((f, i) => (
                      <li key={i} className="font-mono text-[11px] text-foreground">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {teleport.context.recentErrors.length > 0 && (
                <div>
                  <span className="text-foreground">Recent errors:</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {teleport.context.recentErrors.map((e, i) => (
                      <li key={i} className="text-red-400">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {teleport.context.constraints.length > 0 && (
                <div>
                  <span className="text-foreground">Constraints:</span>
                  <ul className="mt-0.5 list-disc list-inside text-foreground">
                    {teleport.context.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Timing */}
          <section className="rounded-lg border border-border bg-secondary/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">Timing</h2>
            <div className="space-y-1 text-[11px] text-foreground">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-foreground">{new Date(teleport.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span className="text-foreground">{new Date(teleport.updatedAt).toLocaleString()}</span>
              </div>
              {teleport.completedAt && (
                <div className="flex justify-between">
                  <span>Completed</span>
                  <span className="text-foreground">{new Date(teleport.completedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}