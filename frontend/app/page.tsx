"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { SessionWorkspace } from "./session/[id]/page";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start sandbox");
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
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <main className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-[360px] flex-col border-b border-border bg-card lg:h-screen lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h1 className="text-lg font-bold text-foreground">Televerse</h1>
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
                className="h-36 min-h-[140px] resize-none text-sm sm:h-40"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>

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
            />
          ) : (
            <div className="flex h-full min-h-[520px] items-center justify-center px-4 py-10 text-center">
              <div className="max-w-md space-y-3">
                <h2 className="text-2xl font-bold text-foreground">
                  Sandbox ready area
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Enter the instruction on the left. After start, the agent browser, VNC stream, actions, and task state appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
