/**
 * Agent API: tool-grounded offers from chain + structured nextAction + server-built calldata.
 * Env: GROQ_API_KEY (+ optional GROQ_MODEL), or OPENAI_API_KEY (+ optional OPENAI_MODEL);
 * AGENT_LLM_TIMEOUT_MS, NEXT_PUBLIC_ESCROW_ADDRESS, RPC_URL, etc.
 */

import { generateObject, generateText, stepCountIs, tool } from "ai";
import { NextResponse } from "next/server";
import { encodeFunctionData } from "viem";
import { z } from "zod";

import {
  type FetchActiveOffersResult,
  fetchActiveOffersForTool,
  type ListedOffer,
} from "@/lib/activeOffers";
import { escrowWriteAbi } from "@/lib/abis";
import { resolveAgentChatModel } from "@/lib/agentLlm";

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

function encodeAcceptOfferCalldata(offerIdStr: string): `0x${string}` {
  return encodeFunctionData({
    abi: escrowWriteAbi,
    functionName: "acceptOffer",
    args: [BigInt(offerIdStr)],
  });
}

function extractFetchOffersFromSteps(
  steps: Array<{ toolResults: Array<{ toolName: string; output: unknown }> }>,
): FetchActiveOffersResult | null {
  for (const step of steps) {
    for (const tr of step.toolResults) {
      if (tr.toolName === "fetch_active_offers") {
        return tr.output as FetchActiveOffersResult;
      }
    }
  }
  return null;
}

/** Deterministic Straw → Apple safe route so demos never break. */
function safeSwapFallback(goal: string, reason: string) {
  const escrow = escrowAddressEnv();
  const oid = fallbackOfferId();
  const g = goal.slice(0, 120);
  const calldata = encodeAcceptOfferCalldata(oid);
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
      calldata,
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

function validateOfferIdAgainstChain(
  offerId: string,
  offers: ListedOffer[],
): boolean {
  const fb = fallbackOfferId();
  if (offers.length > 0) {
    return offers.some((o) => o.offerId === offerId);
  }
  return offerId === fb;
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

  const llmResolved = resolveAgentChatModel();

  console.info("[api/agent] request", {
    goalPreview: goal.slice(0, 200),
    escrowExpected,
    timeoutMs,
    llmProvider: llmResolved.ok ? llmResolved.provider : "none",
    llmModel: llmResolved.ok ? llmResolved.modelId : undefined,
  });

  if (!llmResolved.ok) {
    return NextResponse.json(safeSwapFallback(goal, "no_api_key"));
  }

  const chatModel = llmResolved.model;

  const fetchActiveOffers = tool({
    description:
      "Read WarashibeEscrow on-chain: returns every active offer with maker/desired NFT labels. Call this before choosing offerIdToAccept so ids are real.",
    inputSchema: z.object({}),
    execute: async (): Promise<FetchActiveOffersResult> =>
      fetchActiveOffersForTool(),
  });

  try {
    const pipeline = async (): Promise<{
      obj: {
        thoughtProcess: string[];
        nextAction: z.infer<typeof nextActionSchema>;
      };
      offersList: ListedOffer[];
    }> => {
      const phase1 = await generateText({
        model: chatModel,
        tools: { fetch_active_offers: fetchActiveOffers },
        toolChoice: { type: "tool", toolName: "fetch_active_offers" },
        stopWhen: stepCountIs(5),
        system:
          "You are the Warashibe routing assistant. You MUST call fetch_active_offers first. After the tool returns, reply with one short sentence acknowledging how many active offers were found (or that the chain/RPC was unavailable).",
        prompt: `User barter goal:\n${goal.slice(0, 2000)}`,
      });

      let snapshot = extractFetchOffersFromSteps(phase1.steps);
      if (!snapshot) {
        snapshot = await fetchActiveOffersForTool();
      }

      const offersList: ListedOffer[] = snapshot?.offers ?? [];
      const offersJson = JSON.stringify(offersList, null, 2);

      const fb = fallbackOfferId();
      const objectRace = await generateObject({
        model: chatModel,
        schema: agentResponseSchema,
        system: `You are the Warashibe Protocol routing agent (Straw Millionaire × WarashibeEscrow NFT barter).

Active offers from chain (via fetch_active_offers tool — IDs are authoritative):
${offersJson}

Rules:
- Choose offerIdToAccept that best progresses the user's goal (match desiredLabel / makerLabel semantics: taker receives maker's NFT, gives desired side).
- targetContract MUST be exactly: ${escrowExpected}
- If the list is empty, set offerIdToAccept to "${fb}" (env fallback) and explain no liquidity in thoughtProcess.
- thoughtProcess: 5–12 short plain-text lines: chain-grounded analysis, then the chosen hop.`,
        prompt: `User target outcome:\n${goal.slice(0, 2000)}`,
      });

      return { obj: objectRace.object, offersList };
    };

    const raceResult = await Promise.race([pipeline(), rejectAfter(timeoutMs)]);

    const parsedShape = agentResponseSchema.safeParse(raceResult.obj);
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

    const offersForValidation = raceResult.offersList;

    if (
      !validateOfferIdAgainstChain(
        obj.nextAction.offerIdToAccept,
        offersForValidation,
      )
    ) {
      console.warn("[api/agent] invalid_offer_pick", {
        offerIdToAccept: obj.nextAction.offerIdToAccept,
        allowedCount: offersForValidation.length,
      });
      return NextResponse.json(safeSwapFallback(goal, "zod_failed"));
    }

    const calldata = encodeAcceptOfferCalldata(obj.nextAction.offerIdToAccept);

    console.info("[api/agent] llm_ok", {
      thoughtSteps: obj.thoughtProcess.length,
      nextKind: obj.nextAction.kind,
      offerIdToAccept: obj.nextAction.offerIdToAccept,
      calldataPrefix: calldata.slice(0, 14),
    });

    return NextResponse.json({
      thoughtProcess: obj.thoughtProcess,
      nextAction: {
        ...obj.nextAction,
        calldata,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const reason = msg === "AGENT_LLM_TIMEOUT" ? "timeout" : "llm_error";
    console.error("[api/agent] catch", { reason, message: msg });
    return NextResponse.json(safeSwapFallback(goal, reason));
  }
}
