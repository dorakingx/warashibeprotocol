"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Toaster } from "sonner";
import { coinbaseWallet } from "@/lib/coinbaseWalletConnector";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import {
  base,
  baseSepolia,
  hardhat,
  localhost,
  sepolia,
} from "wagmi/chains";

const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);
/** Chain 31337 is GoChain Testnet in public lists (symbol GO); MetaMask rejects ETH. Prefer 1337 (localhost, ETH). */
const useLocal31337 = configuredChainId === 31_337;
const useLocal1337 = configuredChainId === 1337;
const useEthereumSepolia = configuredChainId === 11155111;
const localRpc =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() || "http://127.0.0.1:8545";

const publicRpc = process.env.NEXT_PUBLIC_RPC_URL?.trim();
const sepoliaRpc =
  useEthereumSepolia && publicRpc?.startsWith("http") ? publicRpc : undefined;

const chains = useLocal1337
  ? ([localhost, sepolia, baseSepolia, base] as const)
  : useLocal31337
    ? ([hardhat, sepolia, baseSepolia, base] as const)
    : useEthereumSepolia
      ? ([sepolia, baseSepolia, base] as const)
      : ([baseSepolia, base] as const);

// Wagmi infers chain IDs from the union of env-driven configs; include every ID so `transports` satisfies Record.
const transports = {
  [localhost.id]: http(useLocal1337 ? localRpc : "http://127.0.0.1:8545"),
  [hardhat.id]: http(useLocal31337 ? localRpc : "http://127.0.0.1:8545"),
  [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
  [baseSepolia.id]: http(),
  [base.id]: http(),
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
    },
  });
}

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Warashibe Protocol",
      preference: { options: "smartWalletOnly" },
    }),
  ],
  transports,
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          toastOptions={{
            classNames: {
              toast:
                "border border-amber-900/60 bg-[#120d0a] text-amber-50 shadow-[4px_4px_0_#292524]",
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
