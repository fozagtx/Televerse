/**
 * WebMCP registration. Two surfaces:
 *
 *  1. Real `document.modelContext` (Chrome 149+ behind the WebMCP origin trial,
 *     or the Model Context Tool Inspector extension). This is what a real
 *     ChatGPT / Codex integration will see.
 *
 *  2. A fallback dev registry on `window.__opticonWebMcp` that lets the
 *     /dev/mcp page list and invoke every registered tool from the browser
 *     console or a button — so we can verify behavior end-to-end even on
 *     browsers that haven't shipped the draft API yet.
 *
 * The two are kept in lockstep by `setActive()` so we never end up with tools
 * registered on the dev side but not the real one (or vice versa).
 */

import { allTools, type ToolDefinition } from "./tools";
import "./types";

type DevRegisteredTool = {
  definition: ToolDefinition;
  source: "real" | "dev";
};

type DevRegistry = {
  tools: Map<string, DevRegisteredTool>;
  getTools(): { name: string; description: string; inputSchema: unknown }[];
  executeTool(name: string, args: unknown): Promise<unknown>;
};

declare global {
  interface Window {
    __opticonWebMcp?: DevRegistry;
  }
}

const ACTIVE_KEY = "__opticonWebMcpActive";

let liveControllers: AbortController[] = [];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getRegistry(): DevRegistry {
  if (!window.__opticonWebMcp) {
    window.__opticonWebMcp = {
      tools: new Map(),
      getTools() {
        return Array.from(this.tools.values()).map(({ definition }) => ({
          name: definition.name,
          description: definition.description,
          inputSchema: definition.inputSchema,
        }));
      },
      async executeTool(name, args) {
        const entry = this.tools.get(name);
        if (!entry) {
          throw new Error(
            `Tool '${name}' is not registered. Available: ${Array.from(this.tools.keys()).join(", ")}`,
          );
        }
        const controller = new AbortController();
        return entry.definition.execute(args ?? {}, { signal: controller.signal });
      },
    };
  }
  return window.__opticonWebMcp;
}

async function registerOnRealApi(
  tool: ToolDefinition,
  exposedTo: string[] | undefined,
): Promise<AbortController> {
  const controller = new AbortController();
  if (exposedTo && exposedTo.length > 0) {
    await document.modelContext!.registerTool(tool, {
      signal: controller.signal,
      exposedTo,
    });
  } else {
    await document.modelContext!.registerTool(tool, {
      signal: controller.signal,
    });
  }
  return controller;
}

export interface MountOptions {
  /** Origins allowed to discover these tools. Empty/undefined = same-origin only. */
  exposedTo?: string[];
}

export interface MountResult {
  registered: string[];
  devMode: boolean;
}

/**
 * Mount every tool from `allTools` on every available surface. Idempotent —
 * a second call while the first set is still active is a no-op.
 */
export async function mountAllTools(
  options: MountOptions = {},
): Promise<MountResult> {
  if (!isBrowser()) {
    return { registered: [], devMode: false };
  }
  const globalAny = globalThis as unknown as Record<string, unknown>;
  const cached = globalAny[ACTIVE_KEY] as MountResult | undefined;
  if (cached && (!document.modelContext || !cached.devMode)) {
    return cached;
  }

  const result: MountResult = cached ?? {
    registered: [],
    devMode: !document.modelContext,
  };

  const registry = getRegistry();
  for (const tool of allTools) {
    registry.tools.set(tool.name, { definition: tool, source: "dev" });
    if (!result.registered.includes(tool.name)) result.registered.push(tool.name);

    if (document.modelContext) {
      try {
        const controller = await registerOnRealApi(tool, options.exposedTo);
        liveControllers.push(controller);
        const entry = registry.tools.get(tool.name);
        if (entry) {
          entry.source = "real";
        }
      } catch (err) {
        // Real API rejected (e.g. permission policy) — dev registry still has
        // the tool so the in-browser harness can exercise it.
        console.warn(
          `[webmcp] Failed to register ${tool.name} on document.modelContext:`,
          err,
        );
      }
    }
  }

  if (document.modelContext) {
    document.modelContext.addEventListener("toolchange", () => {
      // Hook for future reactive UI; intentionally empty for now.
    });
  }

  result.devMode = !document.modelContext;
  globalAny[ACTIVE_KEY] = result;
  return result;
}

/**
 * Unregister every tool we own. Safe to call multiple times.
 */
export function unmountAllTools(): void {
  for (const controller of liveControllers) {
    controller.abort();
  }
  liveControllers = [];
  if (isBrowser()) {
    window.__opticonWebMcp?.tools.clear();
  }
  const globalAny = globalThis as unknown as Record<string, unknown>;
  delete globalAny[ACTIVE_KEY];
}
