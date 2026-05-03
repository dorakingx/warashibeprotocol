export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-20 text-zinc-100">
      <main className="w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          ETHGlobal Open Agents
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Warashibe Protocol
        </h1>
        <p className="mt-5 text-zinc-300">
          Inspired by the Straw Millionaire story, Warashibe Protocol lets users
          define a target asset while an AI agent executes multi-hop NFT barter
          routes on EVM networks.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h2 className="font-semibold">Agentic Swaps</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Trust-minimized peer-to-peer NFT escrow contract for trade hops.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h2 className="font-semibold">Social Distribution</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Farcaster Frame endpoint for one-tap viral sharing and swap entry.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
