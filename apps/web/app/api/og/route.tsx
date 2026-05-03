import { ImageResponse } from "next/og";

export const runtime = "edge";

const MAX = 24;

function sanitize(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const s = raw.replace(/[^\x20-\x7E]/g, "").slice(0, MAX);
  return s.length ? s : fallback;
}

/** Folktale trade card for Farcaster / OG embeds. Query: makerToken, desiredToken (short names). Optional variant=success. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");

  if (variant === "success") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(145deg, #16213e 0%, #1c1410 45%, #292524 100%)",
            border: "16px solid #d97706",
            boxSizing: "border-box",
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "#fde68a",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textShadow: "4px 4px 0 #451a03",
              marginBottom: 24,
            }}
          >
            Warashibe
          </div>
          <div
            style={{
              fontSize: 42,
              color: "#fca5a5",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Swap successful!
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 28,
              color: "#e7e5e4",
              opacity: 0.95,
            }}
          >
            Your barter is on-chain — trade up the tale.
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  }

  const makerToken = sanitize(url.searchParams.get("makerToken"), "Straw");
  const desiredToken = sanitize(url.searchParams.get("desiredToken"), "Apple");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(165deg, #1c1410 0%, #292524 40%, #422006 100%)",
          border: "14px solid #b45309",
          boxSizing: "border-box",
          padding: 56,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "#fcd34d",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textShadow: "3px 3px 0 #451a03",
            marginBottom: 36,
          }}
        >
          Warashibe
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#fef3c7",
              maxWidth: 420,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {makerToken}
          </span>
          <span
            style={{
              fontSize: 52,
              color: "#fbbf24",
              fontWeight: 900,
            }}
          >
            ➔
          </span>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#fef3c7",
              maxWidth: 420,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {desiredToken}
          </span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 26,
            color: "#d6d3d1",
            opacity: 0.92,
            letterSpacing: "0.04em",
          }}
        >
          Trade · Straw Millionaire path
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
