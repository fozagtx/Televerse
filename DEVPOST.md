## Inspiration

You're building a checkout flow with Codex. The agent is on a roll -- shipping tests, wiring up the payment handler, everything flowing. Then a `500` hits `/api/checkout`. Do you stop the agent to investigate? Or push on and hope the error fixes itself?

Both options lose. We wanted a third path: teleport a copy of your agent into an isolated desktop, have it investigate the error, return structured findings -- while your primary agent keeps shipping.

## What it does

Televerse is Agent Teleportation for Codex. It exposes high-level WebMCP tools (`teleport_agent`, `get_teleport_status`, `retrieve_teleport_result`) that AI agents discover and invoke through the browser. When a side problem appears, the user's agent calls `teleport_agent` with a task description. Televerse captures context from the primary session, spawns a fresh Daytona sandbox with a real browser and terminal, and the teleported agent investigates independently. When done, it returns a structured result: summary, root cause, evidence, files inspected, commands run, and an optional patch for review.

## How we built it

Next.js 16 custom server with Socket.io for real-time streaming. The WebMCP draft API (`document.modelContext.registerTool`) exposes seven tools covering the full teleport lifecycle. Each teleport creates an isolated session with its own Daytona cloud desktop, Socket.io room, and whiteboard -- the primary session is never touched. Context is captured as a compact packet (prompt, recent todos, whiteboard, errors, constraints) and seeded into the teleported agent's system prompt. The frontend has a teleport modal, live detail page with activity log and evidence panel, and a dev harness at `/dev/mcp` for testing tools without a browser agent. The orchestrator, teleport store, REST API, and WebMCP registry are all TypeScript in the Next.js app.

## Challenges we ran into

The WebMCP API is a draft -- only in Chrome 149+ behind a flag. We built a dual registry: real `document.modelContext` when available, a dev fallback on `window` for testing. The Daytona swap was mechanical but tedious -- every E2B tool call (`left_click`, `right_click`, `get_url()`) had to be rewritten to Daytona's unified API (`mouse.click(x, y, button)`, `get_preview_link(6080)`). The hard part was designing the TeleportContext: enough context to be useful, but compact enough that the teleported agent doesn't waste tokens.

## Accomplishments that we're proud of

The WebMCP surface works. Open the site in Chrome with the flag enabled, and any browser-based agent discovers `teleport_agent` immediately -- no config, no API keys, no MCP server setup. The teleport lifecycle is fully observable: every state transition is logged, cancellable, and debuggable from the `/teleport/[id]` page. Zero LLM keys needed for the WebMCP path -- just `DAYTONA_API_KEY` for sandbox provisioning. The teleport store has 15 passing tests covering creation, lifecycle, result storage, cancellation, and ownership.

## What we learned

WebMCP changes the agent-web contract. Instead of the agent scraping the DOM and guessing what to click, the site declares high-level tools with explicit schemas. The agent delegates, the site executes. The hardest design problem was the handoff -- not how the sandbox boots, but how the teleported agent's result gets back to the primary agent in a structured, reviewable format. We built `TeleportResult` with summary, root cause, evidence, and patch -- designed to be consumed by both a human in the UI and the primary agent programmatically.

## What's next for Televerse

DB persistence so teleports survive server restarts. Multi-session picker for the teleport modal. Optional autonomous computer-use agent (bring your own Anthropic/OpenAI key) that drives the desktop and collects evidence by actually clicking around. Git-aware teleport context that captures the current branch, diff, and recent commits. Daytona screen recordings for replaying the teleported agent's activity.