"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

const EXAMPLE_PROMPTS = [
  {
    label: "Debug Payment 500",
    prompt:
      "Clone the checkout repo, open the app in the browser, reproduce the payment 500 error. Inspect the network tab and payment handler code. Find the root cause and return a patch.",
  },
  {
    label: "Browser QA Testing",
    prompt:
      "Clone the repo, open it in the browser, and run the QA checks. Look for console errors, broken layout, and form validation issues. Report every failure.",
  },
  {
    label: "Install OpenClaw",
    prompt:
      "Open a terminal, install OpenClaw with curl -fsSL https://openclaw.ai/install.sh | bash, verify the version, and report back.",
  },
];


export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

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
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create session");
      }
      const { sessionId } = await response.json();
      router.push(`/session/${sessionId}/approve`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <h1 className="min-w-0 text-lg font-bold text-foreground">Televerse</h1>
          <Link href="/dev/mcp" className="shrink-0">
            <Button variant="outline" size="sm" className="text-foreground">
              Dev Tools
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
          Teleport an agent to fix a side problem
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          One isolated sandbox spawns, investigates, and returns findings. Your main work continues.
        </p>

        <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Investigate why the checkout API is returning 500..."
            className="min-h-[140px] resize-none border-0 bg-transparent px-4 pt-4 pb-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 sm:px-5"
          />
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">1 sandbox will be spawned</span>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !prompt.trim()}
              className="w-full gap-2 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Decomposing...
                </>
              ) : (
                <>
                  Teleport
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example.label}
              onClick={() => setPrompt(example.prompt)}
              className="rounded-full border border-border bg-background px-4 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              {example.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}