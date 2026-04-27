import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET() {
  const imageUrl =
    "https://images.unsplash.com/photo-1618005198919-d3d4b5a92eee?auto=format&fit=crop&w=1200&q=80";
  const postUrl = `${APP_URL}/api/frame`;

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta property="og:title" content="Warashibe Protocol" />
    <meta property="og:description" content="Agentic on-chain NFT bartering on EVM." />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${imageUrl}" />
    <meta property="fc:frame:button:1" content="Swap" />
    <meta property="fc:frame:post_url" content="${postUrl}" />
  </head>
  <body>
    <h1>Warashibe Protocol Frame</h1>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST() {
  return NextResponse.json({
    message: "Swap action received. Hook this into the agentic trade flow.",
  });
}
