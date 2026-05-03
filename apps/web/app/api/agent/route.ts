/**
 * LLM pathfinding trace via OpenAI. Requires `OPENAI_API_KEY` for live runs;
 * without it, returns a small deterministic fallback so local demos still work.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const logsSchema = z.object({
  logs: z.array(z.string()).min(5).max(20),
});

type AgentBody = {
  goal?: string;
};

function fallbackLogs(goal: string): string[] {
  const g = goal.slice(0, 120);
  return [
    "Analyzing current asset: Straw NFT (starter path)...",
    "Scanning P2P depth and open Warashibe escrows on L2...",
    `Scoring multi-hop barter routes toward: "${g}${goal.length > 120 ? "…" : ""}"`,
    "Step 1: Optimal first hop — Straw for Apple (liquidity match).",
    "Step 2: Projected follow-up — Apple for a higher-order artifact.",
    "Step 3: Composing Farcaster Frame `tx` payload for the first leg...",
  ];
}

export async function POST(request: Request) {
  let body: AgentBody;
  try {
    body = (await request.json()) as AgentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) {
    return NextResponse.json({ error: "goal is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ logs: fallbackLogs(goal) });
  }

  const openai = createOpenAI({ apiKey });

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: logsSchema,
      system: `You are the Warashibe Protocol routing agent (Straw Millionaire folktale × EVM NFT barter).
Output ONLY structured JSON matching the schema. The logs array is an ordered agent trace:
short, vivid lines showing analysis, market scan, 2–3 imaginative NFT swap hops (abstract names ok),
and a final line about preparing a Farcaster Frame transaction or payload for step 1.
Use no markdown; each log is one plain string.`,
      prompt: `User target outcome (their requested asset or destination):\n${goal.slice(0, 2000)}`,
    });

    return NextResponse.json({ logs: object.logs });
  } catch (e) {
    console.error("[api/agent] LLM error", e);
    return NextResponse.json({
      logs: [
        ...fallbackLogs(goal),
        "(LLM unavailable — showing fallback trace.)",
      ],
    });
  }
}
