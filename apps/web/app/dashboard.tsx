"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

const STRAW_ABI = [
  {
    type: "function",
    name: "mintStarterStraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

function getStrawAddress(): `0x${string}` | undefined {
  const raw = process.env.NEXT_PUBLIC_STRAW_NFT_ADDRESS;
  if (!raw || raw === "0x0000000000000000000000000000000000000000") return undefined;
  return raw as `0x${string}`;
}

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const strawAddr = useMemo(() => getStrawAddress(), []);

  const {
    data: mintHash,
    writeContract,
    isPending: mintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract();

  const { isLoading: mintConfirming, isSuccess: mintConfirmed } =
    useWaitForTransactionReceipt({
      hash: mintHash,
    });

  const [goal, setGoal] = useState("");
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const runAgent = useCallback(async () => {
    setAgentError(null);
    setAgentLogs([]);
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
      const data = (await res.json()) as { logs: string[] };
      const logs = data.logs ?? [];
      for (const line of logs) {
        await new Promise((r) => setTimeout(r, 680));
        setAgentLogs((prev) => [...prev, line]);
      }
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : "Agent request failed");
    } finally {
      setAgentRunning(false);
    }
  }, [goal]);

  const onMint = () => {
    if (!address || !strawAddr) return;
    resetMint();
    writeContract({
      address: strawAddr,
      abi: STRAW_ABI,
      functionName: "mintStarterStraw",
      args: [address],
    });
  };

  const primaryConnector = connectors[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1c1410] text-amber-50">
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

        <main className="mt-10 grid flex-1 gap-8 lg:grid-cols-2">
          <article className="flex flex-col rounded-lg border-2 border-amber-900/55 bg-[#0f0b08]/85 p-6 shadow-[4px_4px_0_#292524]">
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-amber-200">
              Mint Straw NFT
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-200/75">
              Claim your starter Straw — the folktale begins here. Requires{" "}
              <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                NEXT_PUBLIC_STRAW_NFT_ADDRESS
              </code>{" "}
              after deploy.
            </p>
            <button
              type="button"
              onClick={onMint}
              disabled={
                !isConnected ||
                !strawAddr ||
                mintPending ||
                mintConfirming ||
                !address
              }
              className="mt-6 self-start rounded border-2 border-emerald-800 bg-emerald-950/50 px-4 py-2.5 font-[family-name:var(--font-pixel)] text-[11px] text-emerald-100 shadow-[2px_2px_0_#14532d] transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!strawAddr
                ? "Set STRAW contract env"
                : mintPending || mintConfirming
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
              <p className="mt-2 text-xs text-red-400/90">{mintError.message}</p>
            )}
          </article>

          <article className="flex flex-col rounded-lg border-2 border-amber-900/55 bg-[#0f0b08]/85 p-6 shadow-[4px_4px_0_#292524]">
            <h2 className="font-[family-name:var(--font-pixel)] text-sm text-amber-200">
              Delegate to AI Agent
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-200/75">
              Name your dream asset — the agent simulates pathfinding and Frame
              payloads for each hop.
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
            {agentError && (
              <p className="mt-3 text-xs text-red-400/90">{agentError}</p>
            )}
            <div className="mt-5 min-h-[160px] flex-1 overflow-y-auto rounded border border-amber-950/80 bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-emerald-400/95 shadow-inner">
              {agentLogs.length === 0 && !agentRunning && (
                <span className="text-amber-700/80">
                  {isConnected
                    ? "> Awaiting your goal…"
                    : "> Connect wallet to delegate."}
                </span>
              )}
              {agentLogs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 12)}`} className="py-0.5">
                  <span className="text-amber-600/90">{"> "}</span>
                  {line}
                </div>
              ))}
              {agentRunning && agentLogs.length === 0 && (
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
