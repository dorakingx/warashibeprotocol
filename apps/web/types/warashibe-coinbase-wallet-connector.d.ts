declare module "@warashibe/coinbase-wallet-connector" {
  import type { CoinbaseWalletParameters } from "@wagmi/connectors";
  import type { CreateConnectorFn } from "@wagmi/core";

  export function coinbaseWallet(
    parameters?: CoinbaseWalletParameters,
  ): CreateConnectorFn;
}
