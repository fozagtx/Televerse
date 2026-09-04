"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, RotateCcw, Send } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudIcon,
  ComputerCloudIcon,
  CursorProgress03Icon,
} from "@hugeicons/core-free-icons";
import { SessionWorkspace } from "./session/[id]/page";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpRequest, setFollowUpRequest] = useState("");

  const handleSubmit = async () => {
    if (!prompt.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          agentCount: 1,
          autoStart: true,
        }),
      });
      const responseText = await response.text();
      let data: { sessionId?: string; error?: string } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          responseText || `Server returned an invalid response (${response.status})`
        );
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to start sandbox");
      }
      if (!data.sessionId) {
        throw new Error("Session was created without an id");
      }
      setActivePrompt(prompt.trim());
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSession = () => {
    setSessionId(null);
    setActivePrompt("");
    setError(null);
    setFollowUpText("");
    setFollowUpRequest("");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <main className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-[360px] flex-col border-b border-border bg-card lg:h-screen lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <Image
                src="/icon.svg"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className="size-8 rounded-lg"
              />
              <h1 className="text-lg font-bold text-foreground">Televerse</h1>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              One prompt starts one sandbox. The live browser, VNC, and action log stay on this screen.
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-5">
            <div className="min-h-0 flex-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Agent instruction
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tell the agent what to do in the web app, fields, browser, or sandbox..."
                readOnly={!!sessionId}
                className="h-28 min-h-[112px] resize-none text-sm sm:h-32"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>

            {sessionId && (
              <div className="shrink-0 space-y-2 border-t border-border pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Follow-up instruction
                </label>
                <Textarea
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder="Give the agent the next instruction..."
                  className="h-24 min-h-[96px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const next = followUpText.trim();
                      if (next) {
                        setFollowUpRequest(next);
                        setFollowUpText("");
                      }
                    }
                  }}
                />
                <Button
                  variant="outline"
                  disabled={!followUpText.trim()}
                  onClick={() => {
                    const next = followUpText.trim();
                    if (!next) return;
                    setFollowUpRequest(next);
                    setFollowUpText("");
                  }}
                  className="h-9 w-full gap-2"
                >
                  <Send className="size-3.5" />
                  Send follow-up
                </Button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground">
                {error}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !prompt.trim()}
                className="h-11 w-full gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Start Sandbox
                  </>
                )}
              </Button>

              {sessionId && (
                <Button
                  variant="outline"
                  onClick={resetSession}
                  className="h-11 w-full gap-2"
                >
                  <RotateCcw className="size-3.5" />
                  New Task
                </Button>
              )}
            </div>
          </div>
        </aside>

        <section className="min-h-[520px] bg-background lg:h-screen lg:min-h-0 lg:overflow-hidden">
          {sessionId ? (
            <SessionWorkspace
              sessionId={sessionId}
              initialPrompt={activePrompt}
              agentCount={1}
              embedded
              followUpRequest={followUpRequest}
              onFollowUpHandled={() => setFollowUpRequest("")}
            />
          ) : isSubmitting ? (
            <LaunchWorkspace />
          ) : (
            <IdleWorkspace />
          )}
        </section>
      </main>
    </div>
  );
}

function IdleWorkspace() {
  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5 sm:px-7">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace idle
        </span>
        <span className="text-xs text-muted-foreground">No active session</span>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex items-center justify-center border-b border-border px-5 py-14 text-center lg:border-b-0 lg:border-r">
          <div className="max-w-sm space-y-4">
            <HugeiconsIcon
              icon={CloudIcon}
              size={46}
              strokeWidth={1.5}
              className="mx-auto text-foreground"
            />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                No sandbox running
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                No agents or cloud desktops are active. Enter an instruction on the left to begin.
              </p>
            </div>
          </div>
        </div>
        <div className="hidden items-center justify-center px-5 lg:flex">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Thinking
            </p>
            <p className="text-sm text-muted-foreground">No active agent</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaunchWorkspace() {
  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5 sm:px-7">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
          Starting session
        </span>
        <span className="text-xs text-muted-foreground">Preparing workspace</span>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex items-center justify-center border-b border-border px-5 py-14 text-center lg:border-b-0 lg:border-r">
          <div className="max-w-sm space-y-5">
            <HugeiconsIcon
              icon={ComputerCloudIcon}
              size={46}
              strokeWidth={1.5}
              className="mx-auto text-foreground"
            />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Provisioning cloud desktop
              </h2>
              <p className="text-sm text-muted-foreground">
                The agent appears here after the sandbox and VNC stream are ready.
              </p>
            </div>
            <div className="space-y-2 text-left text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <HugeiconsIcon icon={CursorProgress03Icon} size={16} className="animate-spin" />
                Creating session
              </div>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={ComputerCloudIcon} size={16} />
                Starting sandbox
              </div>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={CloudIcon} size={16} />
                Waiting for VNC stream
              </div>
            </div>
          </div>
        </div>
        <div className="hidden items-center justify-center px-5 lg:flex">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Thinking
            </p>
            <p className="text-sm text-muted-foreground">Waiting for agent start</p>
          </div>
        </div>
      </div>
    </div>
  );
}
