const SYMBOL = "BTCUSDT";

const BINANCE = {
  price: `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${SYMBOL}`,
  openInterest: `https://fapi.binance.com/fapi/v1/openInterest?symbol=${SYMBOL}`,
  premiumIndex: `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${SYMBOL}`,
};

/** Node.js 18+ built-in fetch (globalThis.fetch) */
const httpFetch = globalThis.fetch;

async function fetchBinance(url, label) {
  try {
    const response = await httpFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `${label}: HTTP ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`
      );
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith(`${label}:`)) {
      throw err;
    }
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (typeof httpFetch !== "function") {
    return res.status(500).json({
      error: "fetch unavailable",
      message: "Node.js 18 built-in fetch is required. Set runtime to nodejs18.x in vercel.json.",
    });
  }

  try {
    const [priceData, oiData, fundingData] = await Promise.all([
      fetchBinance(BINANCE.price, "price"),
      fetchBinance(BINANCE.openInterest, "openInterest"),
      fetchBinance(BINANCE.premiumIndex, "premiumIndex"),
    ]);

    const price = parseFloat(priceData.price);
    const oi = parseFloat(oiData.openInterest);
    const fundingRate = parseFloat(fundingData.lastFundingRate);

    if ([price, oi, fundingRate].some(Number.isNaN)) {
      return res.status(502).json({
        error: "Invalid Binance response",
        message: "One or more fields could not be parsed as numbers",
        raw: { price: priceData, openInterest: oiData, premiumIndex: fundingData },
      });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json({
      price,
      oi,
      fundingRate,
      ts: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error("[api/btc-data]", message, err);

    return res.status(502).json({
      error: "Failed to fetch Binance data",
      message,
      name: err instanceof Error ? err.name : "Error",
    });
  }
};
