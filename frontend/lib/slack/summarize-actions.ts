/**
 * LLM-powered action summarizer for Slack milestone updates.
 *
 * Buffers recent tool actions and uses Haiku to produce a single
 * intent-level sentence (e.g. "Installing project dependencies")
 * instead of raw tool names like "Tool: click".
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.DEDALUS_API_KEY || "";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export interface BufferedAction {
  tool: string;
  args?: Record<string, unknown>;
  reasoning?: string;
}

export async function summarizeActions(
  actions: BufferedAction[],
): Promise<string> {
  if (actions.length === 0) return "Working...";

  const lines = actions.map((a) => {
    if (a.reasoning) return a.reasoning;
    const argsStr = a.args ? JSON.stringify(a.args) : "";
    return `${a.tool}(${argsStr})`;
  });

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: "Summarize what an AI agent is doing on a computer desktop in ONE short sentence (under 15 words). Be specific and describe the intent, not the individual actions. Examples: \"Installing project dependencies\", \"Filling out the login form\", \"Navigating to the settings page\". Respond with the sentence only, no quotes.",
        messages: [
          {
            role: "user",
            content: `Recent actions:\n${lines.join("\n")}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    let text = "";
    for (const block of data.content) {
      if (block.type === "text") text += block.text;
    }
    return text.trim() || "Working...";
  } catch (err) {
    console.error("[summarize-actions] Haiku call failed:", err);
    return "Working...";
  }
}