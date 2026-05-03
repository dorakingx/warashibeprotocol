/**
 * Barrel `@wagmi/connectors` pulls optional peers (porto, accounts) that break Next webpack.
 * `next.config.ts` aliases `@warashibe/coinbase-wallet-connector` → the single dist file.
 */
export { coinbaseWallet } from "@warashibe/coinbase-wallet-connector";
