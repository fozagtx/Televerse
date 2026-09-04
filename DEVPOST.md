## Inspiration

Millions of hours are spent every month watching your AI agent debug a side problem while your main task sits frozen. The checkout flow is half-built, but the payment API is returning 500, and now your agent is stuck investigating instead of shipping.

We wanted to build something that doesn't make you choose between progress and debugging. What if your agent could teleport a copy of itself into a separate desktop, fix the bug over there, and hand you the result while the original agent keeps building?

So we built Televerse.

## What it does

Televerse is a WebMCP-powered web app. Your coding agent (Codex, ChatGPT, any browser-based agent) discovers seven tools on the page. When a side problem comes up, the agent calls `teleport_agent` with a task description. Televerse captures context from the current session, spawns a fresh Daytona sandbox with a browser and terminal, and a second agent investigates independently. When it finishes, it returns a summary, root cause, evidence, files inspected, commands and tests run, and an optional patch. The primary agent reviews and decides whether to apply. Your main task never stops.

## How we built it

Next.js 16 custom server with Socket.io for real-time streaming. The WebMCP draft API (`document.modelContext.registerTool`) registers seven tools on every page load. Each teleport creates a separate session with its own Daytona sandbox, Socket.io room, and whiteboard, the primary session is never touched. Context is captured as a compact packet (prompt, recent todos, whiteboard, errors, constraints) and seeded into the teleported agent's system prompt. The frontend has a teleport modal, a live detail page with activity log and evidence panel, and a dev harness at `/dev/mcp` for testing tools without a browser agent.

## Challenges we ran into

The WebMCP API is a draft, only in Chrome 149+ behind a flag. We built a dual registry: real `document.modelContext` when available, a dev fallback on `window` for testing. The Daytona swap was mechanical but tedious, every sandbox tool call had to be rewritten to Daytona's unified API. The hard part was designing the TeleportContext: enough context to be useful, but compact enough that the teleported agent doesn't waste tokens.

## Accomplishments that we're proud of

The WebMCP surface works. Open the site in Chrome with the flag enabled, and any browser-based agent discovers `teleport_agent` immediately, no config, no API keys, no MCP server setup. The teleport lifecycle is fully observable: every state transition is logged, cancellable, and debuggable from the `/teleport/[id]` page. Zero LLM keys needed for the WebMCP path, just `DAYTONA_API_KEY` for sandbox provisioning. The teleport store has 15 passing tests covering creation, lifecycle, result storage, cancellation, and ownership.

## What we learned

WebMCP changes the agent-web contract. Instead of the agent scraping the DOM and guessing what to click, the site declares high-level tools with explicit schemas. The agent delegates, the site executes. The hardest design problem was the handoff, not how the sandbox boots, but how the teleported agent's result gets back to the primary agent in a structured, reviewable format.

## What's next for Televerse

Adding DB persistence so teleports survive server restarts. Multi-session picker for the teleport modal. Optional autonomous computer-use agent that drives the desktop and collects evidence by actually clicking around. Git-aware teleport context that captures the current branch, diff, and recent commits. Daytona screen recordings for replaying the teleported agent's activity.