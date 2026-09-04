/**
 * Minimal TypeScript types for the WebMCP draft API.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 * Chromium status: https://chromestatus.com/feature/5117755740913664
 *
 * Lives on `document.modelContext` in participating browsers. The `getTools()`
 * and `executeTool()` methods let an in-page agent drive the tools; the
 * browser's built-in agent uses `registerTool()` callbacks directly.
 */

type JSONSchema = Record<string, unknown>;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ToolDefinition<TArgs = unknown> {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: ToolAnnotations;
  /**
   * Bivariant signature: tool authors cast `args` to their concrete shape
   * inside the body. The WebMCP runtime only sees `unknown`, so the
   * contravariance problem disappears. Per-tool validation is the
   * implementer's job; the dev harness surfaces errors back to the agent.
   */
  execute: (
    args: unknown,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
  /** Compile-time-only marker — keeps individual tool authors' `args` typed. */
  __args?: TArgs;
}

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: ToolAnnotations;
  origin: string;
  window: Window;
}

export interface ModelContextRegisterOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export interface ModelContextGetToolsOptions {
  fromOrigins?: string[];
}

export interface ModelContextExecuteOptions {
  signal?: AbortSignal;
}

export interface ModelContext {
  registerTool(
    tool: ToolDefinition,
    options?: ModelContextRegisterOptions,
  ): Promise<void>;
  getTools(
    options?: ModelContextGetToolsOptions,
  ): Promise<RegisteredTool[]>;
  executeTool(
    tool: RegisteredTool,
    argsJson: string,
    options?: ModelContextExecuteOptions,
  ): Promise<unknown>;
  addEventListener(type: "toolchange", listener: () => void): void;
  removeEventListener(type: "toolchange", listener: () => void): void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

export {};
