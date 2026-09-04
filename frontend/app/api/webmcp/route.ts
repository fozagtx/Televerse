import { NextResponse } from "next/server";
import { allTools } from "@/lib/webmcp/tools";

export function GET() {
  return NextResponse.json({
    name: "Televerse WebMCP",
    protocol: "WebMCP",
    discovery: "Tools are registered on document.modelContext when supported.",
    fallback: "The same tools are available at window.__opticonWebMcp.",
    tools: allTools.map(({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      annotations,
    })),
  });
}
