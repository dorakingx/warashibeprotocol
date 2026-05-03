/** WarashibeEscrow fragments for client hooks (watch / write). */

export const escrowEventsAbi = [
  {
    type: "event",
    name: "OfferAccepted",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "taker", type: "address", indexed: true },
      { name: "maker", type: "address", indexed: true },
    ],
  },
] as const;

export const escrowWriteAbi = [
  {
    type: "function",
    name: "acceptOffer",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const erc721BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256", name: "" }],
  },
] as const;

export const erc721SymbolAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string", name: "" }],
  },
] as const;
