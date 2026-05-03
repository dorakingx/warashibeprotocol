/** Short labels for `/api/og` query params (maker = NFT you receive; desired = NFT you give). */

export function shortTokenLabel(full: string): string {
  const t = full.trim().replace(/[\x00-\x1f\x7f]/g, "");
  const idx = t.indexOf(" #");
  if (idx > 0) return t.slice(0, idx).slice(0, 24);
  const word = t.split(/\s+/)[0];
  return (word || t).slice(0, 24) || "?";
}

/** Active-offer frame: receiveLabel = maker's locked NFT; giveLabel = desired NFT from taker. */
export function buildOgTradeImageUrl(
  appUrl: string,
  receiveLabel: string,
  giveLabel: string,
): string {
  const makerToken = shortTokenLabel(receiveLabel);
  const desiredToken = shortTokenLabel(giveLabel);
  const base = appUrl.replace(/\/$/, "");
  const q = new URLSearchParams({ makerToken, desiredToken });
  return `${base}/api/og?${q.toString()}`;
}
