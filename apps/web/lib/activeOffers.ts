import type { PublicClient } from "viem";

import {
  escrowAbi,
  escrowAddressFromEnv,
  getEscrowPublicClient,
  tryTokenLabel,
} from "@/lib/escrow";

/** JSON-serializable row for the LLM and API (ids as decimal strings). */
export type ListedOffer = {
  offerId: string;
  maker: string;
  makerTokenAddress: string;
  makerTokenId: string;
  makerLabel: string;
  desiredTokenAddress: string;
  desiredTokenId: string;
  desiredLabel: string;
  agent: string;
  isActive: true;
};

export type FetchActiveOffersResult =
  | { ok: true; offers: ListedOffer[] }
  | { ok: false; error: string; offers: [] };

/**
 * Walk `offers(1..nextOfferId-1)` and return all active rows with human-readable NFT labels.
 */
export async function listActiveOffers(
  client: PublicClient,
  escrow: `0x${string}`,
): Promise<ListedOffer[]> {
  const nextRaw = await client.readContract({
    address: escrow,
    abi: escrowAbi,
    functionName: "nextOfferId",
  });
  const nextId = nextRaw as bigint;
  const one = BigInt(1);
  if (nextId <= one) return [];

  const out: ListedOffer[] = [];

  for (let i = nextId - one; i >= one; i -= one) {
    const row = await client.readContract({
      address: escrow,
      abi: escrowAbi,
      functionName: "offers",
      args: [i],
    });

    const [
      oid,
      maker,
      makerTokenAddress,
      makerTokenId,
      desiredTokenAddress,
      desiredTokenId,
      agent,
      isActive,
    ] = row as readonly [
      bigint,
      `0x${string}`,
      `0x${string}`,
      bigint,
      `0x${string}`,
      bigint,
      `0x${string}`,
      boolean,
    ];

    if (!isActive) continue;

    const [makerLabel, desiredLabel] = await Promise.all([
      tryTokenLabel(client, makerTokenAddress, makerTokenId),
      tryTokenLabel(client, desiredTokenAddress, desiredTokenId),
    ]);

    out.push({
      offerId: oid.toString(),
      maker,
      makerTokenAddress,
      makerTokenId: makerTokenId.toString(),
      makerLabel,
      desiredTokenAddress,
      desiredTokenId: desiredTokenId.toString(),
      desiredLabel,
      agent,
      isActive: true,
    });
  }

  return out;
}

export async function fetchActiveOffersForTool(): Promise<FetchActiveOffersResult> {
  const client = getEscrowPublicClient();
  const escrow = escrowAddressFromEnv();
  if (!client || !escrow) {
    return { ok: false, error: "rpc_or_escrow_missing", offers: [] };
  }
  try {
    const offers = await listActiveOffers(client, escrow);
    return { ok: true, offers };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[activeOffers] list_failed", msg);
    return { ok: false, error: "read_failed", offers: [] };
  }
}
