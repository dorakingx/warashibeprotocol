import { NextResponse } from "next/server";

/** Used for absolute Frame URLs (Warpcast embed). Set in production / tunnel. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PLACEHOLDER_IMAGE =
  "https://placehold.co/1200x630/1a1a2e/ffffff/png?text=Warashibe+Swap";

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
  const html = frameHtml({
    "og:title": "Trade your Apple NFT for this Straw NFT",
    "og:description":
      "Accept this on-chain barter to swap your NFT for the maker's Straw.",
    "og:image": PLACEHOLDER_IMAGE,
    "fc:frame": "vNext",
    "fc:frame:image": PLACEHOLDER_IMAGE,
    "fc:frame:button:1": "Accept Swap",
    "fc:frame:button:1:action": "tx",
    "fc:frame:button:1:target": txTarget,
    "fc:frame:button:1:post_url": successPostUrl,
  });

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

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
