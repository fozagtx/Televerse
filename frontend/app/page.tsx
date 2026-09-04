"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Zap, ArrowRight } from "lucide-react";
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

interface SessionHistoryItem {
  id: string;
  prompt: string;
  status: string;
  createdAt: string;
  latestThumbnail?: string;
}

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
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-neutral-900">Televerse</h1>
          <Link href="/dev/mcp">
            <Button variant="outline" size="sm" className="text-neutral-700">
              Dev Tools
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12">
        <h2 className="text-3xl font-bold text-neutral-900 sm:text-4xl">
          Teleport an agent to fix a side problem
        </h2>
        <p className="mt-3 text-neutral-600">
          One isolated sandbox spawns, investigates, and returns findings. Your main work continues.
        </p>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Investigate why the checkout API is returning 500..."
            className="min-h-[140px] resize-none border-0 bg-transparent px-5 pt-4 pb-3 text-base text-neutral-900 placeholder:text-neutral-500 focus-visible:ring-0"
          />
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3">
            <span className="text-neutral-500">1 sandbox will be spawned</span>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !prompt.trim()}
              className="gap-2 bg-neutral-900 text-white hover:bg-neutral-800"
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
              className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
            >
              {example.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}