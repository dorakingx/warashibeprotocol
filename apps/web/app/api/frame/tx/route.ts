import { NextResponse } from "next/server";
import { encodeFunctionData } from "viem";

/**
 * Env for WarashibeEscrow acceptOffer tx payload:
 * - NEXT_PUBLIC_ESCROW_ADDRESS — contract `to` (placeholder ok for demo JSON shape)
 * - NEXT_PUBLIC_MOCK_OFFER_ID — uint256 passed to acceptOffer (default 1)
 * - NEXT_PUBLIC_CHAIN_ID — numeric chain id (default 84532 Base Sepolia)
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

export async function POST() {
  const escrowAddress = (
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "0x0000000000000000000000000000000000000000"
  ) as `0x${string}`;

  const offerIdRaw = process.env.NEXT_PUBLIC_MOCK_OFFER_ID ?? "1";
  const offerId = BigInt(offerIdRaw);

  const chainIdNum = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

  const data = encodeFunctionData({
    abi: ACCEPT_OFFER_ABI,
    functionName: "acceptOffer",
    args: [offerId],
  });

  const body = {
    chainId: caip2ChainId(chainIdNum),
    method: "eth_sendTransaction" as const,
    params: {
      abi: ACCEPT_OFFER_ABI,
      to: escrowAddress,
      value: "0",
      data,
    },
  };

  return NextResponse.json(body);
}
