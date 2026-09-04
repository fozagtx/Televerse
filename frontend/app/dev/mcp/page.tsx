"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useWebMcp } from "@/lib/webmcp/provider";
import { allTools, type ToolDefinition } from "@/lib/webmcp/tools";

type SchemaProperty = {
  type?: string;
  enum?: unknown[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};

function defaultValueFor(prop: SchemaProperty): unknown {
  if (prop.enum && prop.enum.length > 0) return prop.enum[0];
  switch (prop.type) {
    case "string":
      return "";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

function buildFormState(tool: ToolDefinition): Record<string, unknown> {
  const schema = tool.inputSchema as {
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
  const out: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    out[key] = defaultValueFor(prop);
  }
  return out;
}

function validateArgs(
  tool: ToolDefinition,
  args: Record<string, unknown>,
): string | null {
  const schema = tool.inputSchema as {
    required?: string[];
    properties?: Record<string, SchemaProperty>;
  };
  for (const key of schema.required ?? []) {
    const value = args[key];
    if (value === undefined || value === null || value === "") {
      return `Missing required argument: ${key}`;
    }
  }
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (prop.minimum !== undefined && typeof args[key] === "number") {
      if ((args[key] as number) < prop.minimum) {
        return `${key} must be >= ${prop.minimum}`;
      }
    }
    if (prop.maximum !== undefined && typeof args[key] === "number") {
      if ((args[key] as number) > prop.maximum) {
        return `${key} must be <= ${prop.maximum}`;
      }
    }
    if (prop.minLength !== undefined && typeof args[key] === "string") {
      if ((args[key] as string).length < prop.minLength) {
        return `${key} must be at least ${prop.minLength} characters`;
      }
    }
  }
  return null;
}

function renderField(
  key: string,
  prop: SchemaProperty,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  if (prop.enum) {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
      >
        {prop.enum.map((v) => (
          <option key={String(v)} value={String(v)}>
            {String(v)}
          </option>
        ))}
      </select>
    );
  }
  if (prop.type === "integer" || prop.type === "number") {
    return (
      <input
        type="number"
        value={Number(value ?? 0)}
        min={prop.minimum}
        max={prop.maximum}
        onChange={(e) =>
          onChange(prop.type === "integer" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))
        }
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
      />
    );
  }
  if (prop.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4"
      />
    );
  }
  if (prop.type === "array") {
    return (
      <textarea
        value={JSON.stringify(value ?? [], null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            // keep raw string until valid
            onChange(e.target.value);
          }
        }}
        className="h-24 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100"
      />
    );
  }
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
    />
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const [args, setArgs] = useState<Record<string, unknown>>(() => buildFormState(tool));
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const schema = tool.inputSchema as {
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
  const properties = schema.properties ?? {};

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const validationError = validateArgs(tool, args);
      if (validationError) {
        setError(validationError);
        return;
      }
      const registry = window.__opticonWebMcp;
      if (!registry) {
        setError("Dev registry not initialized. WebMCP provider failed to mount.");
        return;
      }
      const out = await registry.executeTool(tool.name, args);
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-mono text-sm text-zinc-100">{tool.name}</h3>
        {tool.annotations?.readOnlyHint && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            read
          </span>
        )}
        {tool.annotations?.destructiveHint && (
          <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
            destructive
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-400">{tool.description}</p>

      {Object.keys(properties).length > 0 && (
        <div className="mb-3 space-y-2">
          {Object.entries(properties).map(([key, prop]) => (
            <label key={key} className="block">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className="font-mono">{key}</span>
                {schema.required?.includes(key) && (
                  <span className="text-red-400">required</span>
                )}
                <span className="text-zinc-600">·</span>
                <span>{prop.type ?? "any"}</span>
                {prop.description && (
                  <span className="ml-1 text-zinc-600">— {prop.description}</span>
                )}
              </div>
              {renderField(key, prop, args[key], (v) =>
                setArgs((prev) => ({ ...prev, [key]: v })),
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={running}>
          {running ? "Running…" : "Run"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setArgs(buildFormState(tool));
            setResult(null);
            setError(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Reset
        </button>
      </div>

      {error && (
        <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-red-900/50 bg-red-950/40 p-2 text-[11px] text-red-300">
          {error}
        </pre>
      )}
      {result !== null && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-zinc-800 bg-zinc-900 p-2 text-[11px] text-zinc-200">
          {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function DevMcpPage() {
  const { state, result, error } = useWebMcp();
  const { data: session, status } = useSession();
  const [hasRealApi, setHasRealApi] = useState<boolean | null>(null);

  useEffect(() => {
    const has = typeof document !== "undefined" && Boolean(document.modelContext);
    // Defer to avoid react-compiler cascading-render warning
    const id = setTimeout(() => setHasRealApi(has), 0);
    return () => clearTimeout(id);
  }, []);

  const tools = useMemo(() => allTools, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">
          WebMCP Tool Harness
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Inspect and invoke every Televerse action exposed to AI agents via the
          WebMCP draft API. All calls hit the same backend routes the UI uses,
          so the results mirror what a real Codex or ChatGPT integration would
          receive.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Provider state
          </div>
          <div className="mt-1 font-mono text-sm text-zinc-200">{state}</div>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            document.modelContext
          </div>
          <div className="mt-1 font-mono text-sm text-zinc-200">
            {hasRealApi === null
              ? "checking…"
              : hasRealApi
                ? "available"
                : "not in this browser (dev registry active)"}
          </div>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Auth
          </div>
          <div className="mt-1 font-mono text-sm text-zinc-200">
            {status === "loading"
              ? "checking…"
              : status === "authenticated"
                ? session?.user?.email ?? "signed in"
                : "anonymous (tool calls will 401)"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
          Provider error: {error}
        </div>
      )}

      {result && (
        <div className="mb-6 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
          Mounted {result.registered.length} tools · {result.devMode ? "dev" : "real"} mode
        </div>
      )}

      <div className="space-y-4">
        {tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} />
        ))}
      </div>
    </div>
  );
}
