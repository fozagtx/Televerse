"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerCloudIcon,
  CursorProgress03Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";

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
        {status === "error" ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="max-w-md space-y-2 text-center">
              <HugeiconsIcon
                icon={TerminalIcon}
                size={32}
                strokeWidth={1.7}
                className="mx-auto text-foreground"
              />
              <p className="text-sm font-medium text-destructive">Desktop worker failed</p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {errorMessage || "The worker stopped before a VNC stream was created."}
              </p>
            </div>
          </div>
        ) : status === "terminated" || status === "paused" || status === "expired" ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="max-w-md space-y-2 text-center">
              <HugeiconsIcon icon={ComputerCloudIcon} size={32} strokeWidth={1.7} className="mx-auto text-foreground" />
              <p className="text-sm font-medium text-foreground">Desktop session ended</p>
              <p className="text-xs text-muted-foreground">The VNC connection is no longer available for this sandbox.</p>
            </div>
          </div>
        ) : !streamUrl ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-muted">
                <HugeiconsIcon icon={ComputerCloudIcon} size={24} strokeWidth={1.7} />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Booting sandbox...
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Provisioning a cloud desktop environment
                </p>
              </div>
            <HugeiconsIcon
              icon={CursorProgress03Icon}
              size={18}
              strokeWidth={1.7}
              className="mx-auto animate-spin text-muted-foreground/60"
            />
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
  const [retryCount, setRetryCount] = useState(0);

  const retry = () => {
    setStreamError(null);
    setIsLoading(true);
    setRetryCount((count) => count + 1);
  };

  if (streamError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-sm text-destructive">{streamError}</p>
          <p className="text-xs text-muted-foreground">
            The desktop stream encountered an error
          </p>
          <button
            type="button"
            onClick={retry}
            className="mx-auto inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3.5" />
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="space-y-3 text-center">
            <HugeiconsIcon
              icon={CursorProgress03Icon}
              size={22}
              strokeWidth={1.7}
              className="mx-auto animate-spin text-foreground"
            />
            <p className="text-sm text-muted-foreground">Connecting to stream...</p>
          </div>
        </div>
      )}
      {!isLoading && (
        <button
          type="button"
          onClick={retry}
          className="absolute right-3 top-3 z-20 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background/95 px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          title="Retry the desktop connection"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      )}
      <iframe
        key={`${src}-${retryCount}`}
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
    </div>
  );
}
