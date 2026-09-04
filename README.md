# Televerse

Agent Teleportation for Codex. Teleport isolated agents into cloud desktops to investigate side tasks while your primary coding agent continues uninterrupted.

## How It Works

1. **Submit a prompt** — e.g. *"Research the top 5 AI frameworks and create a comparison spreadsheet"*
2. **Review tasks** — the orchestrator decomposes the prompt into independent subtasks via a kanban board
3. **Watch agents work** — each agent boots a cloud Linux desktop and executes its task with full visibility
4. **See results** — live desktop streams, reasoning sidebar, shared whiteboard, and session replays

Each agent runs a vision-based **observe-think-act** loop: screenshot the desktop, send it to an LLM, receive a mouse/keyboard action, execute it, repeat.

## Architecture

```
Browser (Next.js)  ←Socket.io→  Backend (Node.js)  ←Socket.io→  Python Workers
                                      │                              │
                                      │                         Dedalus Labs SDK
                                      │                         (agent brain)
                                      │                              │
                                 Orchestrator                   E2B Desktop SDK
                                 (Dedalus K2 Think)             (computer control)
                                                                     │
                                                              E2B Cloud Sandboxes
                                                              (isolated Linux VMs)
```

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Real-time**: Socket.io (browser ↔ backend ↔ workers)
- **Orchestrator**: Dedalus Labs TypeScript SDK (K2 Think for task decomposition)
- **Agent brain**: Dedalus Labs Python SDK (vision loop with tool calling)
- **Computer use**: E2B Desktop SDK (cloud Linux sandboxes with noVNC streaming)
- **Auth**: NextAuth with Google OAuth
- **Database**: Neon PostgreSQL via Drizzle ORM
- **Billing**: Flowglad

## Project Structure

```
/frontend
  /app                  Next.js App Router pages and API routes
  /components           React components (agent grid, thinking sidebar, kanban board)
  /lib                  Shared utilities, types, socket setup, session store
  server.ts             Custom HTTP server with Socket.io
/workers
  worker.py             Python agent worker (vision loop)
  e2b_tools.py          E2B Desktop SDK tool wrappers
  replay.py             Session replay/timelapse recording
  /tools                Additional tool modules
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- API keys for Dedalus Labs and E2B

### Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Python workers
pip install -r requirements.txt
```

### Environment Variables

Create `frontend/.env.local`:

```env
DEDALUS_API_KEY=         # Dedalus Labs SDK (orchestrator + agent workers)
E2B_API_KEY=             # E2B sandbox provisioning
PYTHON_PATH=             # Full path to python3 binary
```

### Run

```bash
cd frontend
npm run dev
```

This starts the Next.js dev server with Socket.io. The backend spawns Python worker processes automatically when a session starts.

## Key Design Decisions

- **Agents run outside sandboxes** — Python workers send commands to E2B VMs remotely. API keys and agent code are never exposed to content inside the VM.
- **Push-based task assignment** — The backend assigns tasks to agents (agents don't pull). Avoids race conditions without distributed locking.
- **Vision-based computer use** — Screenshots are injected as actual images into the LLM conversation, not as base64 text in tool results. This is critical for the model to actually "see" the desktop.
- **Session persistence** — Sessions survive browser tab close. Agents keep running and you can reconnect via session ID.

## Agent Teleportation

Televerse supports **Agent Teleportation** — delegating a side task to an isolated computer-use agent without interrupting your primary coding workflow.

### How it works

1. **Your primary agent is running** a Televerse session (e.g. building a checkout flow)
2. **A side problem appears** — a bug, test failure, unclear error, browser issue
3. **Teleport an agent** via the UI (`⚡ Teleport` button) or WebMCP (`teleport_agent` tool)
4. **Televerse captures context** from the primary session: prompt, recent todos, whiteboard, errors, relevant files
5. **A fresh agent spawns** in an isolated E2B sandbox with its own browser and terminal
6. **The teleported agent investigates** — reproduces the issue, inspects logs, runs tests, collects evidence
7. **Results become reviewable** — the primary agent or human reviews the structured findings, root cause, evidence, and optional patch
8. **Apply or discard** — the patch can be reviewed, applied, or discarded via the UI or WebMCP

### WebMCP tools

Televerse exposes 7 WebMCP tools via `document.modelContext` for AI agents (Codex, ChatGPT, etc.) to control teleportation directly:

| Tool | Purpose |
|---|---|
| `teleport_agent` | Create a teleport from a primary session |
| `list_teleports` | List teleports for a session or user |
| `get_teleport_status` | Poll lifecycle phase and activity |
| `retrieve_teleport_result` | Get structured findings, evidence, patch |
| `apply_teleport_patch` | Mark a patch as reviewed/applied |
| `discard_teleport` | Discard a teleport and its workspace |
| `cancel_teleport` | Cancel an in-flight teleport |

### UI

- **Teleport modal** (`⚡ Teleport`) — accessible from the home page and session view
- **Teleport detail page** (`/teleport/[id]`) — live activity, evidence, result, actions
- **Teleport list** on the home page — shows all teleports for the user's active sessions

### Isolation

Teleported agents run in a separate Televerse session with its own Daytona sandbox, Socket.io room, whiteboard, and system prompt. The primary session is never touched. Changes made by the teleported agent are contained in the isolated environment and surfaced as a `patch` for review — never auto-merged.

### Product principle

> **Never stop coding to chase a rabbit hole.**

## License

MIT
