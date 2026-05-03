import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const PLACEHOLDER_IMAGE =
  "https://placehold.co/1200x630/1a1a2e/ffffff/png?text=Warashibe+Swap";

function frameHtml(meta: Record<string, string>): string {
  const tags = Object.entries(meta)
    .map(([property, content]) => `    <meta property="${property}" content="${content}" />`)
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

export async function GET() {
  const postUrl = `${APP_URL}/api/frame`;

  const html = frameHtml({
    "og:title": "Trade your Apple NFT for this Straw NFT",
    "og:description":
      "Accept this on-chain barter to swap your NFT for the maker's Straw.",
    "og:image": PLACEHOLDER_IMAGE,
    "fc:frame": "vNext",
    "fc:frame:image": PLACEHOLDER_IMAGE,
    "fc:frame:button:1": "Accept Swap",
    "fc:frame:post_url": postUrl,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST() {
  const successImage =
    "https://placehold.co/1200x630/16213e/e94560/png?text=Swap+Successful";

  const html = frameHtml({
    "og:title": "Swap Successful!",
    "og:description": "Your barter completed (mock). Connect the agent flow here.",
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
