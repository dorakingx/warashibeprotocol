import { createPublicClient, http, type Chain, type PublicClient } from "viem";
import { base, baseSepolia, hardhat, localhost, sepolia } from "viem/chains";

/** Matches [`packages/contracts/src/WarashibeEscrow.sol`](../../packages/contracts/src/WarashibeEscrow.sol) */
export const escrowAbi = [
  {
    type: "function",
    name: "nextOfferId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "offers",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "offerId" }],
    outputs: [
      { type: "uint256", name: "offerId" },
      { type: "address", name: "maker" },
      { type: "address", name: "makerTokenAddress" },
      { type: "uint256", name: "makerTokenId" },
      { type: "address", name: "desiredTokenAddress" },
      { type: "uint256", name: "desiredTokenId" },
      { type: "address", name: "agent" },
      { type: "bool", name: "isActive" },
    ],
  },
] as const;

const erc721MetaAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string", name: "" }],
  },
] as const;

export type ActiveOffer = {
  offerId: bigint;
  maker: `0x${string}`;
  makerTokenAddress: `0x${string}`;
  makerTokenId: bigint;
  desiredTokenAddress: `0x${string}`;
  desiredTokenId: bigint;
  agent: `0x${string}`;
};

export function escrowAddressFromEnv(): `0x${string}` | undefined {
  const a =
    process.env.ESCROW_ADDRESS ?? process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "";
  if (!a || !/^0x[a-fA-F0-9]{40}$/.test(a)) return undefined;
  return a as `0x${string}`;
}

export function rpcUrlFromEnv(): string | undefined {
  const url = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;
  return url && url.startsWith("http") ? url : undefined;
}

export function chainFromEnv(): Chain {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
  if (id === 8453) return base;
  if (id === 11155111) return sepolia;
  if (id === 1337) return localhost;
  if (id === 31_337) return hardhat;
  if (id === 84532) return baseSepolia;
  return baseSepolia;
}

export function getEscrowPublicClient(): PublicClient | null {
  const rpc = rpcUrlFromEnv();
  if (!rpc) return null;
  return createPublicClient({
    chain: chainFromEnv(),
    transport: http(rpc),
  });
}

export async function tryTokenLabel(
  client: PublicClient,
  tokenAddress: `0x${string}`,
  tokenId: bigint,
): Promise<string> {
  try {
    const symbol = await client.readContract({
      address: tokenAddress,
      abi: erc721MetaAbi,
      functionName: "symbol",
    });
    return `${symbol} #${tokenId.toString()}`;
  } catch {
    return `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)} #${tokenId.toString()}`;
  }
}

export async function findLatestActiveOffer(
  client: PublicClient,
  escrow: `0x${string}`,
): Promise<ActiveOffer | null> {
  const nextRaw = await client.readContract({
    address: escrow,
    abi: escrowAbi,
    functionName: "nextOfferId",
  });
  const nextId = nextRaw as bigint;
  const one = BigInt(1);
  if (nextId <= one) return null;

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

    if (isActive) {
      return {
        offerId: oid,
        maker,
        makerTokenAddress,
        makerTokenId,
        desiredTokenAddress,
        desiredTokenId,
        agent,
      };
    }
  }
  return null;
}

/** Serialize offer id for fc:frame:state (Farcaster echoes in tx POST). */
export function encodeOfferState(offerId: bigint): string {
  const json = JSON.stringify({ offerId: offerId.toString() });
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeOfferIdFromState(state: string | undefined): bigint | null {
  if (!state?.trim()) return null;
  const s = state.trim();
  try {
    let jsonStr: string;
    if (s.startsWith("{")) {
      jsonStr = s;
    } else {
      jsonStr = Buffer.from(s, "base64url").toString("utf8");
    }
    const parsed = JSON.parse(jsonStr) as { offerId?: string };
    if (parsed.offerId == null) return null;
    return BigInt(parsed.offerId);
  } catch {
    return null;
  }
}
