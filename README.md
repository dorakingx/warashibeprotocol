# Warashibe Protocol (EVM)

Warashibe Protocol is an agentic on-chain bartering platform inspired by the
Straw Millionaire story. A user sets a target asset, then an AI agent
coordinates multi-hop NFT swaps to reach that target through trust-minimized
escrow.

This scaffold is tailored for ETHGlobal Open Agents with:
- L2-first EVM deployment (Base / Arbitrum)
- Account Abstraction-ready architecture (ERC-4337 integration path)
- Farcaster Frames for social discovery and viral distribution

## Monorepo Architecture

```text
warashibe-evm/
├── apps/
│   └── web/                  # Next.js App Router app + Frame endpoint
├── packages/
│   └── contracts/            # Foundry project with Solidity contracts/tests
├── .gitignore
└── README.md
```

### `apps/web`
- Next.js (App Router), TypeScript, Tailwind CSS
- Baseline web3 dependencies: `wagmi`, `viem`
- Landing page at `app/page.tsx`
- Farcaster Frame route at `app/api/frame/route.ts`

### `packages/contracts`
- Foundry-style Solidity package
- `StrawNFT.sol`: minimal ERC721-like starter NFT
- `WarashibeEscrow.sol`: boilerplate NFT-for-NFT trustless escrow flow
- `StrawNFT.t.sol`: initial test scaffold

## Prerequisites

- Node.js `>=20.9.0` (recommended: latest LTS)
- npm (or pnpm/yarn if you adapt scripts)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Getting Started

From repository root:

```bash
cd apps/web
npm install
```

If dependencies are already installed, run:

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Farcaster Frame Endpoint

The basic Frame response is available at:

- `GET /api/frame` -> HTML with `fc:frame` metadata, image, and `Swap` button
- `POST /api/frame` -> placeholder JSON response for button actions

For local testing with Frame clients, set:

```bash
NEXT_PUBLIC_APP_URL=https://<your-public-tunnel-url>
```

## Contracts: Build and Test

```bash
cd packages/contracts
forge build
forge test
```

## Hackathon-Oriented Next Steps

- Wire ERC-4337 smart account and delegated agent execution
- Add multi-hop trade planning engine and route state machine
- Harden escrow with signatures, deadlines, fees, and dispute patterns
- Deploy to Base / Arbitrum testnet with scripted verification
- Replace placeholder frame response with real trade session actions
