/**
 * Structured agent response: thoughtProcess + nextAction for acceptOffer.
 * Requires OPENAI_API_KEY for LLM; otherwise returns deterministic fallback with valid shape.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const nextActionSchema = z.object({
  kind: z.literal("acceptOffer"),
  targetContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  offerIdToAccept: z.string().regex(/^[0-9]+$/),
  tokenToOffer: z
    .object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      tokenId: z.string().regex(/^[0-9]+$/),
    })
    .optional(),
});

const agentResponseSchema = z.object({
  thoughtProcess: z.array(z.string()).min(5).max(25),
  nextAction: nextActionSchema,
});

type AgentBody = {
  goal?: string;
};

function escrowAddressEnv(): string {
  return (
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS ??
    "0x0000000000000000000000000000000000000000"
  );
}

function fallbackOfferId(): string {
  return (
    process.env.NEXT_PUBLIC_MOCK_OFFER_ID ??
    process.env.FRAME_FALLBACK_OFFER_ID ??
    "1"
  );
}

function fallbackPayload(goal: string) {
  const g = goal.slice(0, 120);
  const escrow = escrowAddressEnv();
  const oid = fallbackOfferId();
  return {
    thoughtProcess: [
      "Analyzing current asset: Straw NFT (starter path)...",
      "Scanning P2P depth and open Warashibe escrows on L2...",
      `Scoring multi-hop barter routes toward: "${g}${goal.length > 120 ? "…" : ""}"`,
      "Step 1: Optimal first hop — accept the live escrow offer matching liquidity.",
      "Step 2: Projected follow-up — chain another hop toward the stated goal.",
      "Encoding nextAction: acceptOffer on WarashibeEscrow for the first leg.",
    ],
    nextAction: {
      kind: "acceptOffer" as const,
      targetContract: escrow,
      offerIdToAccept: oid,
    },
  };
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
    return NextResponse.json(fallbackPayload(goal));
  }

  const escrow = escrowAddressEnv();
  const openai = createOpenAI({ apiKey });

  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: agentResponseSchema,
      system: `You are the Warashibe Protocol routing agent (Straw Millionaire folktale × EVM NFT barter on WarashibeEscrow).
Output ONLY JSON matching the schema.

thoughtProcess: ordered short plain-text lines (no markdown): analysis, liquidity scan, 2–3 imaginative NFT hop names, then encoding the next on-chain step.

nextAction MUST use:
- kind: "acceptOffer"
- targetContract: exactly this escrow address (checksummed or lowercase ok): ${escrow}
- offerIdToAccept: a plausible decimal string for the FIRST executable leg (use "${fallbackOfferId()}" if unsure — demo default).

Optional tokenToOffer if you want to name the NFT the user still holds.`,
      prompt: `User target outcome:\n${goal.slice(0, 2000)}`,
    });

    return NextResponse.json({
      thoughtProcess: object.thoughtProcess,
      nextAction: object.nextAction,
    });
  } catch (e) {
    console.error("[api/agent] LLM error", e);
    const fb = fallbackPayload(goal);
    return NextResponse.json({
      thoughtProcess: [
        ...fb.thoughtProcess,
        "(LLM unavailable — using fallback nextAction.)",
      ],
      nextAction: fb.nextAction,
    });
  }
}
