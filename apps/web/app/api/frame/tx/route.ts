import { NextResponse } from "next/server";
import { encodeFunctionData } from "viem";
import {
  decodeOfferIdFromState,
  escrowAddressFromEnv,
} from "@/lib/escrow";

/**
 * Farcaster posts JSON with `untrustedData.state` echoing `fc:frame:state`.
 * Fallback: FRAME_FALLBACK_OFFER_ID or NEXT_PUBLIC_MOCK_OFFER_ID (dev).
 *
 * Env:
 * - ESCROW_ADDRESS / NEXT_PUBLIC_ESCROW_ADDRESS — transaction `to`
 * - NEXT_PUBLIC_CHAIN_ID — defaults to 84532 (Base Sepolia)
 */

const ACCEPT_OFFER_ABI = [
  {
    type: "function",
    name: "acceptOffer",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
] as const;

function caip2ChainId(numericChainId: number): string {
  return `eip155:${numericChainId}`;
}

type FrameBody = {
  untrustedData?: {
    state?: string;
    address?: string;
  };
};

export async function POST(request: Request) {
  let body: FrameBody = {};
  try {
    body = (await request.json()) as FrameBody;
  } catch {
    /* empty body */
  }

  const fromState = decodeOfferIdFromState(body.untrustedData?.state);
  const fallbackRaw =
    process.env.FRAME_FALLBACK_OFFER_ID ??
    process.env.NEXT_PUBLIC_MOCK_OFFER_ID ??
    "1";
  const offerId = fromState ?? BigInt(fallbackRaw);

  const escrowAddress = escrowAddressFromEnv() ?? "0x0000000000000000000000000000000000000000";
  const chainIdNum = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

  const data = encodeFunctionData({
    abi: ACCEPT_OFFER_ABI,
    functionName: "acceptOffer",
    args: [offerId],
  });

  const res = {
    chainId: caip2ChainId(chainIdNum),
    method: "eth_sendTransaction" as const,
    params: {
      abi: ACCEPT_OFFER_ABI,
      to: escrowAddress as `0x${string}`,
      value: "0",
      data,
    },
  };

  return NextResponse.json(res);
}
