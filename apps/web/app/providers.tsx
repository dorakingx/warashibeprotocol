"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Toaster } from "sonner";
import { coinbaseWallet } from "@/lib/coinbaseWalletConnector";
import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
    },
  });
}

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Warashibe Protocol",
      preference: { options: "smartWalletOnly" },
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
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
