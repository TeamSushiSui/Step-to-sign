const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const DEMO_KEY = "CG-kcTo33v4GLnJk2HsAHh7mAu4";

const COIN_TYPE_TO_COINGECKO = {
  "0x2::sui::SUI": "sui",
};

function guessCoinGeckoIdFromCoinType(coinType) {
  const lower = (coinType || "").toLowerCase();
  if (lower.endsWith("::sui::sui")) return "sui";
  if (lower.includes("usdc")) return "usd-coin";
  if (lower.includes("usdt")) return "tether";
  return null;
}

export function coinTypeToCoingeckoId(coinType) {
  if (COIN_TYPE_TO_COINGECKO[coinType]) return COIN_TYPE_TO_COINGECKO[coinType];
  return guessCoinGeckoIdFromCoinType(coinType);
}

export async function fetchPrices(ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  if (unique.length === 0) return {};
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(
    unique.join(",")
  )}&vs_currencies=usd`;
  const headers = { accept: "application/json", "x-cg-demo-api-key": DEMO_KEY };
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`);
  const json = await res.json();
  const out = {};
  unique.forEach((id) => {
    out[id] = json?.[id]?.usd ?? 0;
  });
  return out;
}

// Known decimals per token. Extend as needed.
const DECIMALS_MAP = {
  "0x2::sui::SUI": 9,
  // USDC/USDT often 6 decimals. Add your exact coinType for accuracy.
  // "0x2::coin::Coin<0x...::usdc::USDC>": 6,
  // "0x2::coin::Coin<0x...::usdt::USDT>": 6,
};

export function getDecimals(coinType) {
  if (DECIMALS_MAP[coinType] != null) return DECIMALS_MAP[coinType];
  const lower = (coinType || "").toLowerCase();
  if (lower.endsWith("::sui::sui")) return 9;
  if (lower.includes("usdc") || lower.includes("usdt")) return 6;
  return 9; // reasonable default
}

const TokenPriceService = {
  coinTypeToCoingeckoId,
  fetchPrices,
  getDecimals,
};

export default TokenPriceService;
