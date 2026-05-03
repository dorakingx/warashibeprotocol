import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@warashibe/coinbase-wallet-connector": path.join(
        process.cwd(),
        "node_modules/@wagmi/connectors/dist/esm/coinbaseWallet.js",
      ),
    };
    return config;
  },
};

export default nextConfig;
