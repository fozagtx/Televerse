import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import {
  addAgent,
  getSession,
  updateAgentStatus,
} from "./session-store";
import { getIO } from "./socket";
import { getSlackSessionBySessionId } from "./slack/session-adapter";
import type { Agent } from "./types";

// Track worker processes per session
const workerProcesses = new Map<string, Map<string, ChildProcess>>();

// In dev, cwd is frontend/ so go up one level. In Docker, cwd is /app and workers/ is a sibling.
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..");
const WORKER_ERROR_TAIL_LINES = 12;

function rememberOutput(lines: string[], data: Buffer): void {
  const chunkLines = data.toString().trim().split("\n").filter(Boolean);
  lines.push(...chunkLines);
  if (lines.length > WORKER_ERROR_TAIL_LINES) {
    lines.splice(0, lines.length - WORKER_ERROR_TAIL_LINES);
  }
}

function markWorkerFailed(
  sessionId: string,
  agentId: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  outputLines: string[],
): void {
  if (code === 0 || (code === null && signal)) return;

  const detail = outputLines.length > 0 ? `: ${outputLines.join("\n")}` : "";
  const error = `Worker exited before the desktop stream became available${code !== null ? ` (code ${code})` : ""}${detail}`;

  updateAgentStatus(sessionId, agentId, "error");

  try {
    getIO().to(`session:${sessionId}`).emit("agent:error", {
      agentId,
      error,
    });
  } catch (err) {
    console.error("[worker-manager] Failed to broadcast worker error:", err);
  }
}

function markWorkerSpawnFailed(sessionId: string, agentId: string, err: Error): void {
  updateAgentStatus(sessionId, agentId, "error");

  try {
    getIO().to(`session:${sessionId}`).emit("agent:error", {
      agentId,
      error: `Worker process failed to start: ${err.message}`,
    });
  } catch (broadcastErr) {
    console.error("[worker-manager] Failed to broadcast worker spawn error:", broadcastErr);
  }
}

export function spawnWorkers(sessionId: string, agentCount: number): void {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const sessionWorkers = new Map<string, ChildProcess>();
  workerProcesses.set(sessionId, sessionWorkers);

  for (let i = 0; i < agentCount; i++) {
    const agentId = uuidv4();
    const agent: Agent = {
      id: agentId,
      name: `Agent ${i + 1}`,
      sessionId,
      status: "booting",
      currentTaskId: null,
      tasksCompleted: 0,
      tasksTotal: 0,
    };
    addAgent(sessionId, agent);

    const pythonPath = process.env.PYTHON_PATH || "python3";
    const slackSession = getSlackSessionBySessionId(sessionId);
    const workerProcess = spawn(pythonPath, ["workers/worker.py"], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        SESSION_ID: sessionId,
        AGENT_ID: agentId,
        USER_ID: session.userId || "",
SOCKET_URL: process.env.WORKER_SOCKET_URL || `http://localhost:${process.env.PORT || "3000"}`,
FEATHERLESS_API_KEY: process.env.FEATHERLESS_API_KEY || "",
        FEATHERLESS_MODEL: process.env.FEATHERLESS_MODEL || "zai-org/GLM-5.3",
E2B_API_KEY: process.env.E2B_API_KEY || "",
        // Panopticon: Enable long-running mode for Panopticon sessions
        PANOPTICON_MODE: session.isPanopticon ? "true" : "false",
        // Slack: enable step checkpoints when running from a Slack session
        ...(slackSession ? { SLACK_SESSION: "true" } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    sessionWorkers.set(agentId, workerProcess);
    const outputLines: string[] = [];
    console.log(
      `[worker-manager] Spawned worker for agent ${agentId} (pid: ${workerProcess.pid})`
    );

    // Log stdout (worker may print debug info)
    workerProcess.stdout?.on("data", (data: Buffer) => {
      rememberOutput(outputLines, data);
      console.log(`[worker:${agentId}] ${data.toString().trim()}`);
    });

    // Log stderr
    workerProcess.stderr?.on("data", (data: Buffer) => {
      rememberOutput(outputLines, data);
      console.error(`[worker:${agentId}:stderr] ${data.toString().trim()}`);
    });

    workerProcess.on("error", (err) => {
      console.error(`[worker-manager] Agent ${agentId} failed to start:`, err);
      markWorkerSpawnFailed(sessionId, agentId, err);
    });

    workerProcess.on("exit", (code, signal) => {
      console.log(`[worker-manager] Agent ${agentId} exited with code ${code}`);
      sessionWorkers.delete(agentId);
      markWorkerFailed(sessionId, agentId, code, signal, outputLines);
    });
  }
}

export function respawnWorker(sessionId: string, agent: Agent): void {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  let sessionWorkers = workerProcesses.get(sessionId);
  if (!sessionWorkers) {
    sessionWorkers = new Map<string, ChildProcess>();
    workerProcesses.set(sessionId, sessionWorkers);
  }

  // Don't respawn if already running
  if (sessionWorkers.has(agent.id)) return;

  const pythonPath = process.env.PYTHON_PATH || "python3";
  const workerProcess = spawn(pythonPath, ["workers/worker.py"], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      SESSION_ID: sessionId,
      AGENT_ID: agent.id,
      USER_ID: session.userId || "",
      SOCKET_URL: process.env.WORKER_SOCKET_URL || `http://localhost:${process.env.PORT || "3000"}`,
      DAYTONA_API_KEY: process.env.DAYTONA_API_KEY || "",
      FEATHERLESS_API_KEY: process.env.FEATHERLESS_API_KEY || "",
        FEATHERLESS_MODEL: process.env.FEATHERLESS_MODEL || "zai-org/GLM-5.3",
      SANDBOX_ID: agent.sandboxId || "",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  sessionWorkers.set(agent.id, workerProcess);
  const outputLines: string[] = [];
  console.log(
    `[worker-manager] Respawned worker for agent ${agent.id} (pid: ${workerProcess.pid}, sandbox: ${agent.sandboxId})`
  );

  workerProcess.stdout?.on("data", (data: Buffer) => {
    rememberOutput(outputLines, data);
    console.log(`[worker:${agent.id}] ${data.toString().trim()}`);
  });

  workerProcess.stderr?.on("data", (data: Buffer) => {
    rememberOutput(outputLines, data);
    console.error(`[worker:${agent.id}:stderr] ${data.toString().trim()}`);
  });

  workerProcess.on("error", (err) => {
    console.error(`[worker-manager] Agent ${agent.id} failed to start:`, err);
    markWorkerSpawnFailed(sessionId, agent.id, err);
  });

  workerProcess.on("exit", (code, signal) => {
    console.log(`[worker-manager] Agent ${agent.id} exited with code ${code}`);
    sessionWorkers?.delete(agent.id);
    markWorkerFailed(sessionId, agent.id, code, signal, outputLines);
  });
}

export function killAllWorkers(sessionId: string): void {
  const sessionWorkers = workerProcesses.get(sessionId);
  if (!sessionWorkers) return;

  for (const [agentId, proc] of sessionWorkers) {
    console.log(`[worker-manager] Killing worker ${agentId}`);
    proc.kill("SIGTERM");
    updateAgentStatus(sessionId, agentId, "terminated");
  }

  workerProcesses.delete(sessionId);
}
