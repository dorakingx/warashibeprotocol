import { NextResponse } from "next/server";

type AgentBody = {
  goal?: string;
};

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

  const logs = [
    "Analyzing current asset: Straw...",
    "Searching market depth...",
    "Step 1: Found optimal swap - Straw for Apple.",
    "Step 2: Found future swap - Apple for Sword.",
    `Targeting outcome: "${goal.slice(0, 120)}${goal.length > 120 ? "…" : ""}"`,
    "Generating Farcaster Frame payload for Step 1...",
  ];

  return NextResponse.json({ logs });
}
