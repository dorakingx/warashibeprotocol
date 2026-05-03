import { NextResponse } from "next/server";
import {
  encodeOfferState,
  escrowAddressFromEnv,
  findLatestActiveOffer,
  getEscrowPublicClient,
  tryTokenLabel,
} from "@/lib/escrow";

/** Used for absolute Frame URLs (Warpcast embed). Set in production / tunnel. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PLACEHOLDER_IMAGE =
  "https://placehold.co/1200x630/1a1a2e/ffffff/png?text=Warashibe+Swap";

const NO_OFFERS_IMAGE =
  "https://placehold.co/1200x630/292524/d6d3d1/png?text=No+open+offers";

function frameHtml(meta: Record<string, string>): string {
  const tags = Object.entries(meta)
    .map(([property, content]) => {
      const escaped = content
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;");
      return `    <meta property="${property}" content="${escaped}" />`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
  <head>
${tags}
  </head>
  <body>
    <p>Warashibe Protocol Frame</p>
  </body>
</html>`;
}

const txTarget = `${APP_URL}/api/frame/tx`;
const successPostUrl = `${APP_URL}/api/frame`;

export async function GET() {
  const escrow = escrowAddressFromEnv();
  const client = getEscrowPublicClient();

  if (!client || !escrow) {
    const html = frameHtml({
      "og:title": "Warashibe · Configure RPC",
      "og:description":
        "Set RPC_URL and ESCROW_ADDRESS (or NEXT_PUBLIC_ESCROW_ADDRESS) for live offers.",
      "og:image": PLACEHOLDER_IMAGE,
      "fc:frame": "vNext",
      "fc:frame:image": PLACEHOLDER_IMAGE,
      "fc:frame:button:1": "Open app",
      "fc:frame:button:1:action": "link",
      "fc:frame:button:1:target": APP_URL,
    });
    return htmlResponse(html);
  }

  const active = await findLatestActiveOffer(client, escrow);

  if (!active) {
    const html = frameHtml({
      "og:title": "Warashibe · No open offers",
      "og:description":
        "There are no active swaps on-chain right now. Check back after a maker lists one.",
      "og:image": NO_OFFERS_IMAGE,
      "fc:frame": "vNext",
      "fc:frame:image": NO_OFFERS_IMAGE,
      "fc:frame:button:1": "Open Warashibe",
      "fc:frame:button:1:action": "link",
      "fc:frame:button:1:target": APP_URL,
    });
    return htmlResponse(html);
  }

  const [receiveLabel, giveLabel] = await Promise.all([
    tryTokenLabel(client, active.makerTokenAddress, active.makerTokenId),
    tryTokenLabel(client, active.desiredTokenAddress, active.desiredTokenId),
  ]);

  const shortOfferId = active.offerId.toString();
  const title = `Offer #${shortOfferId} · barter on-chain`.slice(0, 96);
  const description =
    `You give: ${giveLabel}. You receive: ${receiveLabel}.`.slice(0, 280);

  const state = encodeOfferState(active.offerId);

  const html = frameHtml({
    "og:title": title,
    "og:description": description,
    "og:image": PLACEHOLDER_IMAGE,
    "fc:frame": "vNext",
    "fc:frame:image": PLACEHOLDER_IMAGE,
    "fc:frame:state": state,
    "fc:frame:button:1": "Accept Swap",
    "fc:frame:button:1:action": "tx",
    "fc:frame:button:1:target": txTarget,
    "fc:frame:button:1:post_url": successPostUrl,
  });

  return htmlResponse(html);
}

function htmlResponse(html: string) {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** After a successful tx, clients POST here (per button post_url) with transactionId. */
export async function POST() {
  const successImage =
    "https://placehold.co/1200x630/16213e/e94560/png?text=Swap+Successful";

  const html = frameHtml({
    "og:title": "Swap Successful!",
    "og:description":
      "On-chain acceptOffer submitted. Your barter is in flight — follow the agent for the next hop.",
    "og:image": successImage,
    "fc:frame": "vNext",
    "fc:frame:image": successImage,
  });

  return htmlResponse(html);
}
