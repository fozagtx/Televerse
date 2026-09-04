# Televerse

Agent Teleportation for Codex. Teleport isolated agents into cloud desktops to investigate side tasks while your primary coding agent continues uninterrupted.

## How It Works

1. **Your agent is running** a Televerse session (e.g. building a checkout flow)
2. **A side problem appears** — a bug, test failure, unclear error, browser issue
3. **Teleport an agent** via the UI (`⚡ Teleport` button) or WebMCP (`teleport_agent` tool)
4. **Televerse captures context** from the session: prompt, recent todos, whiteboard, errors, relevant files
5. **A fresh agent spawns** in an isolated Daytona sandbox with its own browser and terminal
6. **The teleported agent investigates** — reproduces the issue, inspects logs, runs tests, collects evidence
7. **Results become reviewable** — the user or agent reviews the structured findings, root cause, evidence, and optional patch
8. **Apply or discard** — the patch can be reviewed, applied, or discarded via the UI or WebMCP

## Architecture

```
Browser (Codex/ChatGPT)
      │
      │ WebMCP (document.modelContext)
      ▼
Televerse Web App (Next.js 16 + Socket.io)
      │
      ├─── REST API (/api/teleports, /api/sessions)
      ├─── In-memory session + teleport store
      └─── Socket.io (real-time streaming)
              │
              ▼
        Daytona Sandbox
        (isolated cloud Linux desktop)
              │
              ├── Browser
              ├── Terminal
              └── Computer Use API
```

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **Real-time**: Socket.io (browser ↔ backend ↔ workers)
- **WebMCP**: 7 tools registered via `document.modelContext.registerTool()`
- **Sandboxes**: Daytona cloud desktops with VNC streaming
- **Database**: Optional (in-memory by default, Render Postgres or Neon supported)

## Project Structure

```
/frontend
  /app                  Next.js App Router pages and API routes
    /api/teleports      Teleport REST API
    /api/sessions       Session REST API
    /teleport/[id]      Teleport detail page
    /dev/mcp            WebMCP tool harness
  /components           React components
  /lib
    /webmcp             WebMCP tool definitions, registry, provider
    /teleport           Teleport types, store, orchestrator, context capture
    session-store.ts    In-memory session store
  server.ts             Custom HTTP server with Socket.io
/workers
  worker.py             Python agent worker
  daytona_tools.py      Daytona sandbox tool wrappers
  replay.py             Session replay recording
  /tools                Additional tool modules
```

## WebMCP tools

Televerse exposes 7 tools via `document.modelContext` for AI agents (Codex, ChatGPT, etc.):

| Tool | Purpose |
|---|---|
| `teleport_agent` | Create a teleport from a session |
| `list_teleports` | List teleports for a session or user |
| `get_teleport_status` | Poll lifecycle phase and activity |
| `retrieve_teleport_result` | Get structured findings, evidence, patch |
| `apply_teleport_patch` | Mark a patch as reviewed/applied |
| `discard_teleport` | Discard a teleport and its workspace |
| `cancel_teleport` | Cancel an in-flight teleport |

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+ (only needed for autonomous agent workers)
- Daytona API key (get one at https://app.daytona.io/dashboard/keys)

### Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Python workers (optional)
pip install -r workers/requirements.txt
```

### Environment Variables

Create `frontend/.env.local`:

```env
DAYTONA_API_KEY=         # Daytona sandbox provisioning (required)
DAYTONA_TARGET=us        # Daytona target region
```

### Run

```bash
cd frontend
npm run dev
```

Opens at http://localhost:3000. The WebMCP tool harness is at http://localhost:3000/dev/mcp.

**Live site:** https://televerse-egjd.onrender.com

## Testing

```bash
cd frontend
npm test
```

The teleport store has 15 tests covering creation, lifecycle transitions, result storage, cancellation, apply/discard, and ownership:

```bash
npx vitest run lib/teleport/__tests__/store.test.ts
```

## Key Design Decisions

- **WebMCP is the agent interface** — Codex/ChatGPT discovers tools via `document.modelContext`. No backend MCP server needed.
- **No LLM key required** — The WebMCP path is pure REST. You only need `DAYTONA_API_KEY` for sandbox provisioning.
- **Context capture is compact** — The teleported agent receives a focused context packet (prompt, recent todos, errors, whiteboard), not the full conversation.
- **Isolation is real** — Every teleport gets its own Daytona sandbox, Socket.io room, and whiteboard. The original session is never touched.

## Deploy

See `render.yaml` for the Docker-based deployment. Televerse runs on Render as a single web service with optional Python workers.

```bash
# Push and deploy via Render Blueprint
git push origin master
# Then deploy from https://dashboard.render.com
```

## License

MIT