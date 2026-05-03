/**
 * Structured agent response with resilient fallbacks for live demos.
 * Env: OPENAI_API_KEY, AGENT_LLM_TIMEOUT_MS (default 20000), NEXT_PUBLIC_ESCROW_ADDRESS, etc.
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

function normalizeAddr(a: string): string {
  return a.toLowerCase();
}

function isValidOfferIdDigits(s: string): boolean {
  if (!/^[0-9]+$/.test(s)) return false;
  return s.length <= 78;
}

/** Deterministic Straw → Apple safe route so demos never break. */
function safeSwapFallback(goal: string, reason: string) {
  const escrow = escrowAddressEnv();
  const oid = fallbackOfferId();
  const g = goal.slice(0, 120);
  console.info("[api/agent] fallback", {
    reason,
    escrow,
    offerIdToAccept: oid,
    goalPreview: g.length ? `${g}${goal.length > 120 ? "…" : ""}` : "(empty)",
  });

  return {
    thoughtProcess: [
      "Analyzing inventory: Straw NFT in hand (folk starter path)...",
      "Route anchor: classical Straw → Apple hop — safest demo leg on WarashibeEscrow.",
      `Goal alignment: "${g}${goal.length > 120 ? "…" : ""}"`,
      "Liquidity scan: matching open offers toward Apple-class NFT depth.",
      "Encoding nextAction: acceptOffer on deployed escrow with fallback offer id.",
    ],
    nextAction: {
      kind: "acceptOffer" as const,
      targetContract: escrow,
      offerIdToAccept: oid,
    },
  };
}

function llmTimeoutMs(): number {
  const raw = process.env.AGENT_LLM_TIMEOUT_MS;
  const n = raw ? Number(raw) : 20000;
  return Number.isFinite(n) && n > 0 ? n : 20000;
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("AGENT_LLM_TIMEOUT")), ms);
  });
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

  const escrowExpected = escrowAddressEnv();
  const timeoutMs = llmTimeoutMs();

  console.info("[api/agent] request", {
    goalPreview: goal.slice(0, 200),
    escrowExpected,
    timeoutMs,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(safeSwapFallback(goal, "no_api_key"));
  }

  const openai = createOpenAI({ apiKey });

  try {
    const raceResult = await Promise.race([
      generateObject({
        model: openai("gpt-4o-mini"),
        schema: agentResponseSchema,
        system: `You are the Warashibe Protocol routing agent (Straw Millionaire folktale × EVM NFT barter on WarashibeEscrow).
Output ONLY JSON matching the schema.

thoughtProcess: ordered short plain-text lines (no markdown): analysis, liquidity scan, 2–3 imaginative NFT swap hops, then encoding the next on-chain step.

nextAction MUST use:
- kind: "acceptOffer"
- targetContract: exactly this escrow address: ${escrowExpected}
- offerIdToAccept: decimal string for the FIRST executable leg (use "${fallbackOfferId()}" if unsure).

Optional tokenToOffer if naming the NFT the user still holds.`,
        prompt: `User target outcome:\n${goal.slice(0, 2000)}`,
      }),
      rejectAfter(timeoutMs),
    ]);

    const parsedShape = agentResponseSchema.safeParse(raceResult.object);
    if (!parsedShape.success) {
      console.warn("[api/agent] zod_failed", parsedShape.error.flatten());
      return NextResponse.json(safeSwapFallback(goal, "zod_failed"));
    }

    const obj = parsedShape.data;
    const targetNorm = normalizeAddr(obj.nextAction.targetContract);
    const escrowNorm = normalizeAddr(escrowExpected);

    if (targetNorm !== escrowNorm) {
      console.warn("[api/agent] contract_mismatch", {
        got: obj.nextAction.targetContract,
        expected: escrowExpected,
      });
      return NextResponse.json(safeSwapFallback(goal, "contract_mismatch"));
    }

    if (!isValidOfferIdDigits(obj.nextAction.offerIdToAccept)) {
      console.warn("[api/agent] zod_failed", {
        detail: "invalid_offer_id",
        offerIdToAccept: obj.nextAction.offerIdToAccept,
      });
      return NextResponse.json(safeSwapFallback(goal, "zod_failed"));
    }

    console.info("[api/agent] llm_ok", {
      thoughtSteps: obj.thoughtProcess.length,
      nextKind: obj.nextAction.kind,
      offerIdToAccept: obj.nextAction.offerIdToAccept,
    });

    return NextResponse.json({
      thoughtProcess: obj.thoughtProcess,
      nextAction: obj.nextAction,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const reason =
      msg === "AGENT_LLM_TIMEOUT" ? "timeout" : "llm_error";
    console.error("[api/agent] catch", { reason, message: msg });
    return NextResponse.json(safeSwapFallback(goal, reason));
  }
}
