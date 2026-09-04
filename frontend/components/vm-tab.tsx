"use client";

import { useState } from "react";
import { Loader2, Monitor } from "lucide-react";

interface VMTabProps {
  agentId: string;
  sessionId: string;
  streamUrl?: string;
  isActive: boolean;
  status?: string;
  errorMessage?: string;
}

export function VMTab({ agentId, streamUrl, isActive, status, errorMessage }: VMTabProps) {
  return (
    <div className={`flex h-full flex-col bg-background absolute inset-0 ${isActive ? "visible z-10" : "invisible z-0"}`}>
      {/* Stream content */}
      <div className="relative flex-1">
        {!streamUrl && status === "error" ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="max-w-md space-y-2 text-center">
              <p className="text-sm font-medium text-destructive">Desktop worker failed</p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {errorMessage || "The worker stopped before a VNC stream was created."}
              </p>
            </div>
          </div>
        ) : !streamUrl ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-muted">
                <Monitor className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Booting sandbox...
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Provisioning a cloud desktop environment
                </p>
              </div>
              <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground/60" />
            </div>
          </div>
        ) : (
          <StreamFrame key={streamUrl} src={streamUrl} agentId={agentId} />
        )}
      </div>
    </div>
  );
}

function StreamFrame({
  src,
  agentId,
}: {
  src: string;
  agentId: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  if (streamError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-sm text-destructive">{streamError}</p>
          <p className="text-xs text-muted-foreground">
            The desktop stream encountered an error
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connecting to stream...</p>
          </div>
        </div>
      )}
      <iframe
        src={src}
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setStreamError("Failed to load desktop stream");
        }}
        title={`Desktop stream for agent ${agentId}`}
      />
    </>
  );
}
