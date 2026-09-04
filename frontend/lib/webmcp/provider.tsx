"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { mountAllTools, unmountAllTools, type MountResult } from "./registry";

type Ctx = {
  state: "idle" | "loading" | "ready" | "error";
  result: MountResult | null;
  error: string | null;
};

const WebMcpContext = createContext<Ctx>({
  state: "idle",
  result: null,
  error: null,
});

export function WebMcpProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [ctx, setCtx] = useState<Ctx>({ state: "idle", result: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function mount() {
      if (status === "loading") return;
      if (status !== "authenticated" || !session?.user) {
        // Anonymous users still get the dev registry so /dev/mcp works
        // for the "tools list" view, but tools that hit the API will
        // surface 401s when invoked — which is the correct behavior.
        setCtx({ state: "loading", result: null, error: null });
        try {
          const result = await mountAllTools();
          if (cancelled) return;
          setCtx({ state: "ready", result, error: null });
        } catch (err) {
          if (cancelled) return;
          setCtx({
            state: "error",
            result: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }
      setCtx({ state: "loading", result: null, error: null });
      try {
        const result = await mountAllTools();
        if (cancelled) return;
        setCtx({ state: "ready", result, error: null });
      } catch (err) {
        if (cancelled) return;
        setCtx({
          state: "error",
          result: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    mount();
    return () => {
      cancelled = true;
    };
  }, [session, status]);

  useEffect(() => {
    return () => {
      unmountAllTools();
    };
  }, []);

  return <WebMcpContext.Provider value={ctx}>{children}</WebMcpContext.Provider>;
}

export function useWebMcp(): Ctx {
  return useContext(WebMcpContext);
}
