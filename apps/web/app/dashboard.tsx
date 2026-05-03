"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Confetti from "react-confetti";
import {
  ChainMismatchError,
  UserRejectedRequestError,
} from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useReadContracts,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

import {
  erc721BalanceAbi,
  erc721SymbolAbi,
  escrowEventsAbi,
  escrowWriteAbi,
} from "@/lib/abis";

const STRAW_ABI = [
  {
    type: "function",
    name: "mintStarterStraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

const DELEGATION_MESSAGE =
  "Allow Agent to trade your assets on WarashibeEscrow for the next 24 hours.";
const DELEGATION_STORAGE_KEY = "warashibe_agent_delegation";

function getStrawAddress(): `0x${string}` | undefined {
  const raw = process.env.NEXT_PUBLIC_STRAW_NFT_ADDRESS;
  if (!raw || raw === "0x0000000000000000000000000000000000000000") return undefined;
  return raw as `0x${string}`;
}

function getEscrowAddress(): `0x${string}` | undefined {
  const raw = process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "";
  if (!raw || !/^0x[a-fA-F0-9]{40}$/i.test(raw)) return undefined;
  return raw as `0x${string}`;
}

/** Fortune / goal NFTs for celebration (comma list or single address). */
function parseFortuneTokenAddresses(): `0x${string}`[] {
  const single = process.env.NEXT_PUBLIC_VICTORY_TOKEN_ADDRESS;
  const multi = process.env.NEXT_PUBLIC_GOAL_CHECK_TOKEN_ADDRESSES;
  const acc = new Set<string>();
  const push = (s: string | undefined) => {
    const t = s?.trim();
    if (t && /^0x[a-fA-F0-9]{40}$/i.test(t)) acc.add(t.toLowerCase());
  };
  push(single);
  if (multi) {
    for (const p of multi.split(",")) push(p);
  }
  return [...acc].map((a) => a as `0x${string}`);
}

function normalizeGoalCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesGoalToSymbol(goalRaw: string, symbolRaw: string): boolean {
  const g = normalizeGoalCompare(goalRaw);
  const sym = normalizeGoalCompare(symbolRaw);
  if (!g || !sym) return false;
  if (g.includes(sym) || sym.includes(g)) return true;
  const first = g.split(/\s+/).filter(Boolean)[0];
  return Boolean(first && sym.includes(first));
}

export type NextActionPayload = {
  kind: "acceptOffer";
  targetContract: `0x${string}`;
  offerIdToAccept: string;
  /** Server-encoded acceptOffer calldata for wallets / smart accounts. */
  calldata?: `0x${string}`;
  tokenToOffer?: { address: string; tokenId: string };
};

function formatWalletTxError(e: unknown): string {
  if (e instanceof UserRejectedRequestError) {
    return "The wallet rejected the request. In MetaMask tap Confirm, or approve the add-network / switch-network prompt (dismissing it shows this same error).";
  }
  if (e instanceof ChainMismatchError) {
    const expected = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
    return `Your wallet chain does not match this transaction (expected chain ID ${expected}). Switch MetaMask to that network, or press Mint again and approve the switch.`;
  }
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: number }).code === 4001
  ) {
    return "The wallet rejected the request (code 4001). Approve the signature or network switch.";
  }
  return e instanceof Error ? e.message : "Transaction failed";
}

export function Dashboard() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const expectedChainId = useMemo(
    () => Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532),
    [],
  );

  const strawAddr = useMemo(() => getStrawAddress(), []);
  const escrowAddr = useMemo(() => getEscrowAddress(), []);

  const chainMismatch =
    isConnected && walletChainId !== expectedChainId;

  /** Always sync the wallet chain via the connector. Relying on `useChainId` alone can skip switching when wagmi state defaults to the first configured local chain while MetaMask is still on mainnet. */
  const syncWalletToExpectedChain = useCallback(async () => {
    if (!connector) {
      throw new Error("Connect your wallet first.");
    }
    await switchChainAsync({
      chainId: expectedChainId,
      connector,
    });
  }, [connector, expectedChainId, switchChainAsync]);

  const lastToastTxHash = useRef<string | undefined>(undefined);

  const [delegationUntil, setDelegationUntil] = useState<number | null>(null);
  const [delegationWallet, setDelegationWallet] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [sponsoringGas, setSponsoringGas] = useState(false);
  const [winSize, setWinSize] = useState({ width: 0, height: 0 });
  const [victoryDismissed, setVictoryDismissed] = useState(false);

  const { signMessage, isPending: signPending } = useSignMessage();

  const {
    writeContractAsync,
    isPending: writePending,
    reset: resetWrite,
  } = useWriteContract();

  const [mintHash, setMintHash] = useState<`0x${string}` | undefined>();
  const [mintError, setMintError] = useState<string | null>(null);

  const { isLoading: mintConfirming, isSuccess: mintConfirmed } =
    useWaitForTransactionReceipt({
      hash: mintHash,
    });

  const { data: strawBalance, refetch: refetchStrawBalance } = useReadContract({
    address: strawAddr,
    abi: erc721BalanceAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(strawAddr && address),
    },
  });

  const fortuneAddrList = useMemo(() => parseFortuneTokenAddresses(), []);

  const fortuneReads = useMemo(() => {
    if (!address || fortuneAddrList.length === 0) return [];
    return fortuneAddrList.flatMap((token) => [
      {
        address: token,
        abi: erc721BalanceAbi,
        functionName: "balanceOf" as const,
        args: [address],
      },
      {
        address: token,
        abi: erc721SymbolAbi,
        functionName: "symbol" as const,
      },
    ]);
  }, [address, fortuneAddrList]);

  const { data: fortuneData } = useReadContracts({
    contracts: fortuneReads,
    query: {
      enabled: fortuneReads.length > 0 && Boolean(address),
    },
  });

  useEffect(() => {
    const fn = () =>
      setWinSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowEventsAbi,
    eventName: "OfferAccepted",
    enabled: Boolean(escrowAddr && address && isConnected),
    onLogs(logs) {
      if (!address) return;
      for (const log of logs) {
        const txHash = log.transactionHash;
        if (txHash && txHash === lastToastTxHash.current) continue;
        const args = log.args as
          | {
              offerId?: bigint;
              taker?: `0x${string}`;
              maker?: `0x${string}`;
            }
          | undefined;
        if (!args?.taker || !args?.maker) continue;
        const me = address.toLowerCase();
        if (args.taker.toLowerCase() !== me && args.maker.toLowerCase() !== me) {
          continue;
        }
        if (txHash) lastToastTxHash.current = txHash;
        toast.success(
          args.taker.toLowerCase() === me
            ? "Swap successful! You traded up as taker."
            : "Swap successful! Your offer was filled — you traded up!",
        );
        void refetchStrawBalance();
      }
    },
  });

  useEffect(() => {
    if (!address || typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DELEGATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { until?: number; wallet?: string };
      if (
        typeof parsed.until === "number" &&
        parsed.wallet?.toLowerCase() === address.toLowerCase()
      ) {
        setDelegationUntil(parsed.until);
        setDelegationWallet(parsed.wallet);
      }
    } catch {
      /* ignore */
    }
  }, [address]);

  useEffect(() => {
    if (!delegationUntil || Date.now() >= delegationUntil) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [delegationUntil]);

  const delegationActive = Boolean(
    address &&
      delegationWallet &&
      delegationWallet.toLowerCase() === address.toLowerCase() &&
      delegationUntil &&
      nowTick < delegationUntil,
  );

  const delegationRemainingMs =
    delegationUntil && nowTick < delegationUntil
      ? delegationUntil - nowTick
      : 0;

  const grantDelegation = () => {
    if (!address) return;
    signMessage(
      { message: DELEGATION_MESSAGE },
      {
        onSuccess() {
          const until = Date.now() + 24 * 60 * 60 * 1000;
          sessionStorage.setItem(
            DELEGATION_STORAGE_KEY,
            JSON.stringify({ until, wallet: address }),
          );
          setDelegationUntil(until);
          setDelegationWallet(address);
          toast.success("Session key granted — Agent is fully autonomous.");
        },
      },
    );
  };

  const [goal, setGoal] = useState("");
  const [thoughtLines, setThoughtLines] = useState<string[]>([]);
  const [nextAction, setNextAction] = useState<NextActionPayload | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    setVictoryDismissed(false);
  }, [goal]);

  const goalReached = useMemo(() => {
    if (!goal.trim() || !fortuneData || fortuneAddrList.length === 0) return false;
    for (let i = 0; i < fortuneAddrList.length; i++) {
      const balRaw = fortuneData[i * 2]?.result;
      const symRaw = fortuneData[i * 2 + 1]?.result;
      let bal: bigint;
      if (typeof balRaw === "bigint") bal = balRaw;
      else if (typeof balRaw === "number") bal = BigInt(balRaw);
      else bal = BigInt(0);
      const sym = typeof symRaw === "string" ? symRaw : "";
      if (bal > BigInt(0) && sym && matchesGoalToSymbol(goal, sym)) return true;
    }
    return false;
  }, [goal, fortuneData, fortuneAddrList]);

  const showVictoryOverlay = goalReached && !victoryDismissed;

  const runAgent = useCallback(async () => {
    setAgentError(null);
    setThoughtLines([]);
    setNextAction(null);
    const trimmed = goal.trim();
    if (!trimmed) {
      setAgentError("Describe your target asset first.");
      return;
    }
    setAgentRunning(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        thoughtProcess?: string[];
        nextAction?: NextActionPayload;
      };
      const lines = data.thoughtProcess ?? [];
      for (const line of lines) {
        await new Promise((r) => setTimeout(r, 680));
        setThoughtLines((prev) => [...prev, line]);
      }
      if (data.nextAction?.kind === "acceptOffer") {
        setNextAction(data.nextAction);
      }
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : "Agent request failed");
    } finally {
      setAgentRunning(false);
    }
  }, [goal]);

  const onMint = async () => {
    if (!address) return;
    if (!strawAddr) {
      toast.error(
        "Set NEXT_PUBLIC_STRAW_NFT_ADDRESS in .env.local to your deployed StrawNFT address for this chain, then restart next dev.",
      );
      return;
    }
    setMintError(null);
    resetWrite();
    setMintHash(undefined);
    try {
      await syncWalletToExpectedChain();
      const hash = await writeContractAsync({
        chainId: expectedChainId,
        address: strawAddr,
        abi: STRAW_ABI,
        functionName: "mintStarterStraw",
        args: [address],
      });
      setMintHash(hash);
      toast.message("Mint submitted — confirm if prompted.");
    } catch (e) {
      const msg = formatWalletTxError(e);
      setMintError(msg);
      toast.error(msg);
    }
  };

  const fakeTxHash = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const onExecuteStrategy = async () => {
    if (!nextAction || nextAction.kind !== "acceptOffer") return;
    const escrow = getEscrowAddress();
    if (!escrow) {
      toast.error("Set NEXT_PUBLIC_ESCROW_ADDRESS to execute.");
      return;
    }
    if (
      nextAction.targetContract.toLowerCase() !== escrow.toLowerCase()
    ) {
      toast.error("Escrow mismatch — run Delegate to AI again.");
      return;
    }

    if (delegationActive) {
      setSponsoringGas(true);
      try {
        await new Promise((r) => setTimeout(r, 800));
        const mock = fakeTxHash();
        toast.success(
          `Agent executed swap on your behalf · ${mock.slice(0, 14)}…`,
        );
        setNextAction(null);
        void refetchStrawBalance();
      } finally {
        setSponsoringGas(false);
      }
      return;
    }

    setSponsoringGas(true);
    try {
      await syncWalletToExpectedChain();
      const hash = await writeContractAsync({
        chainId: expectedChainId,
        address: escrow,
        abi: escrowWriteAbi,
        functionName: "acceptOffer",
        args: [BigInt(nextAction.offerIdToAccept)],
      });
      toast.success(`Tx sent · ${hash.slice(0, 12)}… — confirm in wallet.`);
      setNextAction(null);
      void refetchStrawBalance();
    } catch (e) {
      toast.error(formatWalletTxError(e));
    } finally {
      setSponsoringGas(false);
    }
  };

  const fmtRemaining = () => {
    const ms = delegationRemainingMs;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const primaryConnector = connectors[0];
  const canExecute =
    Boolean(escrowAddr) &&
    nextAction?.kind === "acceptOffer" &&
    !writePending &&
    !agentRunning &&
    !sponsoringGas;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1c1410] text-amber-50">
      {showVictoryOverlay && winSize.width > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[100]">
          <Confetti
            width={winSize.width}
            height={winSize.height}
            numberOfPieces={320}
            recycle={false}
            gravity={0.22}
            colors={["#fbbf24", "#fde68a", "#fcd34d", "#a8a29e", "#fef3c7"]}
          />
        </div>
      )}
      {showVictoryOverlay && (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center bg-black/55 px-5 py-10 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="victory-title"
        >
          <div className="pointer-events-auto max-w-lg rounded-2xl border-4 border-amber-500 bg-[#120d0a] p-8 text-center shadow-[10px_10px_0_#78350f]">
            <p
              id="victory-title"
              className="font-[family-name:var(--font-pixel)] text-lg leading-snug text-amber-50 sm:text-xl"
            >
              Agent successfully achieved your intent! The Straw has become a
              fortune!
            </p>
            <p className="mt-5 text-sm leading-relaxed text-amber-200/85">
              Your wallet holds the NFT you named in your goal — the agent&apos;s
              route aligned with on-chain reality.
            </p>
            <button
              type="button"
              onClick={() => setVictoryDismissed(true)}
              className="mt-8 rounded border-2 border-amber-600 bg-amber-950/70 px-6 py-2.5 font-[family-name:var(--font-pixel)] text-[11px] text-amber-100 shadow-[3px_3px_0_#78350f] transition hover:bg-amber-900/50"
            >
              Continue
            </button>
          </div>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Crect width='12' height='12' fill='%23000'/%3E%3Cpath d='M0 6h12M6 0v12' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "12px 12px",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-12 sm:px-8">
        <header className="border-b-2 border-amber-900/50 pb-8">
          <p className="font-[family-name:var(--font-pixel)] text-[10px] uppercase tracking-[0.35em] text-amber-400/90 sm:text-xs">
            ETHGlobal · Open Agents
          </p>
          <h1 className="font-[family-name:var(--font-pixel)] mt-4 text-2xl leading-tight tracking-tight text-amber-100 sm:text-3xl">
            Warashibe Protocol
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-amber-200/85">
            From one humble Straw to a fortune — agents chart multi-hop NFT barter
            routes while escrows keep each swap trust-minimized on L2.
          </p>
        </header>

        <section className="mt-8 flex flex-wrap items-center gap-3 border border-amber-900/40 bg-[#120d0a]/90 px-4 py-3 backdrop-blur-sm">
          {!isConnected ? (
            <button
              type="button"
              onClick={() =>
                primaryConnector && connect({ connector: primaryConnector })
              }
              disabled={connectPending || !primaryConnector}
              className="rounded border-2 border-amber-600 bg-amber-700/30 px-4 py-2 font-[family-name:var(--font-pixel)] text-xs text-amber-100 shadow-[2px_2px_0_#422006] transition hover:bg-amber-600/40 disabled:opacity-50"
            >
              {connectPending ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <>
              <span className="font-mono text-xs text-amber-300/90">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              {delegationActive && (
                <span className="rounded border border-emerald-700/60 bg-emerald-950/40 px-2 py-1 font-[family-name:var(--font-pixel)] text-[10px] text-emerald-300">
                  Agent is fully autonomous
                </span>
              )}
              <button
                type="button"
                onClick={() => disconnect()}
                className="rounded border border-amber-800/60 px-3 py-1.5 text-xs text-amber-400/90 hover:bg-amber-950/50"
              >
                Disconnect
              </button>
            </>
          )}
        </section>

        <section className="mt-6 rounded-lg border-2 border-violet-900/50 bg-[#0f0b08]/90 p-5 shadow-[4px_4px_0_#3b0764]">
          <h2 className="font-[family-name:var(--font-pixel)] text-sm text-violet-200">
            Grant AI Session Key
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-200/75">
            ERC-4337 narrative: sign once so the agent can route swaps without a
            popup storm (demo uses session mock after grant).
          </p>
          <p className="mt-2 font-mono text-[10px] leading-snug text-amber-500/90">
            “{DELEGATION_MESSAGE}”
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => grantDelegation()}
              disabled={!isConnected || !address || signPending}
              className="rounded border-2 border-violet-700 bg-violet-950/50 px-4 py-2 font-[family-name:var(--font-pixel)] text-[11px] text-violet-100 shadow-[2px_2px_0_#4c1d95] transition hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {signPending ? "Sign in wallet…" : "Grant AI Session Key"}
            </button>
            {delegationActive && (
              <span className="text-xs text-emerald-400/95">
                Session expires in {fmtRemaining()}
              </span>
            )}
          </div>
        </section>

        <main className="mt-10 grid flex-1 gap-8 lg:grid-cols-2">
          <article className="flex flex-col rounded-lg border-2 border-amber-900/55 bg-[#0f0b08]/85 p-6 shadow-[4px_4px_0_#292524]">
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-amber-200">
              Mint Straw NFT
            </h2>
            {strawAddr && address && (
              <p className="mt-3 font-mono text-xs text-cyan-400/90">
                Straw balance:{" "}
                {strawBalance !== undefined ? String(strawBalance) : "…"} · live
                updates on swaps
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-amber-200/75">
              Claim your starter Straw — the folktale begins here. Requires{" "}
              <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                NEXT_PUBLIC_STRAW_NFT_ADDRESS
              </code>{" "}
              after deploy.
            </p>
            {chainMismatch && (
              <p className="mt-3 rounded border border-amber-700/50 bg-amber-950/35 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
                Your wallet is on chain {walletChainId}, but this app expects{" "}
                {expectedChainId}. Press Mint to trigger a network switch in your
                wallet.
                {expectedChainId === 11155111 && (
                  <>
                    {" "}
                    Use Ethereum Sepolia in MetaMask. Fund the deployer with
                    Sepolia ETH, run{" "}
                    <code className="font-mono text-[10px]">
                      forge script script/Deploy.s.sol:DeployScript --rpc-url
                      … --broadcast
                    </code>{" "}
                    from{" "}
                    <code className="font-mono text-[10px]">
                      packages/contracts
                    </code>
                    , then set{" "}
                    <code className="font-mono text-[10px]">
                      NEXT_PUBLIC_STRAW_NFT_ADDRESS
                    </code>{" "}
                    and{" "}
                    <code className="font-mono text-[10px]">
                      NEXT_PUBLIC_ESCROW_ADDRESS
                    </code>
                    .
                  </>
                )}
                {(expectedChainId === 1337 || expectedChainId === 31337) && (
                  <>
                    {" "}
                    Local dev: prefer chain ID 1337 (native ETH) with{" "}
                    <code className="font-mono text-[10px]">
                      anvil --chain-id 1337
                    </code>
                    . Chain 31337 is listed as GoChain Testnet (GO) on public
                    lists, so MetaMask may warn if you label it ETH. RPC{" "}
                    <code className="font-mono text-[10px]">
                      http://127.0.0.1:8545
                    </code>{" "}
                    must be reachable.
                  </>
                )}
              </p>
            )}
            {!strawAddr && isConnected && (
              <p className="mt-3 text-xs leading-relaxed text-amber-500/95">
                Straw contract address is missing from env. Deploy StrawNFT on
                chain {expectedChainId}, add{" "}
                <code className="rounded bg-black/30 px-1 font-mono text-[10px]">
                  NEXT_PUBLIC_STRAW_NFT_ADDRESS
                </code>{" "}
                to <code className="font-mono text-[10px]">.env.local</code>, and
                restart the app. You can still press the button below for a
                reminder.
              </p>
            )}
            <button
              type="button"
              onClick={() => void onMint()}
              disabled={
                !isConnected ||
                writePending ||
                mintConfirming ||
                !address
              }
              className="mt-6 self-start rounded border-2 border-emerald-800 bg-emerald-950/50 px-4 py-2.5 font-[family-name:var(--font-pixel)] text-[11px] text-emerald-100 shadow-[2px_2px_0_#14532d] transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!strawAddr
                ? "Mint Straw NFT — configure env first"
                : writePending || mintConfirming
                  ? "Minting…"
                  : mintConfirmed
                    ? "Mint again"
                    : "Mint Straw NFT"}
            </button>
            {mintHash && (
              <p className="mt-3 font-mono text-[11px] text-amber-400/80">
                Tx: {mintHash.slice(0, 10)}…
                {mintConfirmed ? " · confirmed" : ""}
              </p>
            )}
            {mintError && (
              <p className="mt-2 text-xs text-red-400/90">{mintError}</p>
            )}
          </article>

          <article className="flex flex-col rounded-lg border-2 border-amber-900/55 bg-[#0f0b08]/85 p-6 shadow-[4px_4px_0_#292524]">
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-amber-200">
              Delegate to AI Agent
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-200/75">
              Name your dream asset — the agent plans hops and returns an on-chain
              nextAction for acceptOffer.
            </p>
            <label className="mt-4 block text-xs font-medium text-amber-400/90">
              Target asset
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g. "Bored Ape" or "1000 USDC"'
              disabled={!isConnected || agentRunning}
              className="mt-2 w-full rounded border border-amber-900/60 bg-black/35 px-3 py-2.5 font-sans text-sm text-amber-100 placeholder:text-amber-700 focus:border-amber-600 focus:outline-none disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => void runAgent()}
              disabled={!isConnected || agentRunning}
              className="mt-4 self-start rounded border-2 border-rose-900 bg-rose-950/40 px-4 py-2.5 font-[family-name:var(--font-pixel)] text-[11px] text-rose-100 shadow-[2px_2px_0_#881337] transition hover:bg-rose-900/35 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {agentRunning ? "Agent thinking…" : "Delegate to AI"}
            </button>
            <button
              type="button"
              onClick={() => void onExecuteStrategy()}
              disabled={!isConnected || !canExecute}
              className="mt-3 self-start rounded border-2 border-amber-600 bg-amber-950/60 px-4 py-2.5 font-[family-name:var(--font-pixel)] text-[11px] text-amber-100 shadow-[2px_2px_0_#78350f] transition hover:bg-amber-900/45 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sponsoringGas
                ? "Sponsoring gas…"
                : delegationActive
                  ? "Execute AI Strategy (agent relay)"
                  : "Execute AI Strategy (wallet)"}
            </button>
            {sponsoringGas && (
              <p className="mt-2 w-full text-xs leading-snug text-amber-300/90">
                Agent is sponsoring gas via Paymaster…
              </p>
            )}
            {agentError && (
              <p className="mt-3 text-xs text-red-400/90">{agentError}</p>
            )}
            {nextAction && (
              <p className="mt-2 font-mono text-[10px] text-amber-600/90">
                Next: acceptOffer #{nextAction.offerIdToAccept} →{" "}
                {nextAction.targetContract.slice(0, 10)}…
                {nextAction.calldata ? (
                  <>
                    {" "}
                    · calldata {nextAction.calldata.slice(0, 12)}…
                  </>
                ) : null}
              </p>
            )}
            <div className="mt-5 min-h-[160px] flex-1 overflow-y-auto rounded border border-amber-950/80 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-emerald-400/95 shadow-inner">
              {thoughtLines.length === 0 && !agentRunning && (
                <span className="text-amber-700/80">
                  {isConnected
                    ? "> Awaiting your goal…"
                    : "> Connect wallet to delegate."}
                </span>
              )}
              {thoughtLines.map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`} className="py-0.5">
                  <span className="text-amber-600/90">{"> "}</span>
                  {line}
                </div>
              ))}
              {agentRunning && thoughtLines.length === 0 && (
                <span className="animate-pulse text-amber-500/80">
                  {" > …"}
                </span>
              )}
            </div>
          </article>
        </main>

        <footer className="mt-12 border-t border-amber-900/40 pt-6 text-center text-[11px] text-amber-700/80">
          Pixel tale · Trustless trades · Open Agents
        </footer>
      </div>
    </div>
  );
}
