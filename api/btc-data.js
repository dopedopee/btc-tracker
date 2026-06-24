const SYMBOL = "BTCUSDT";

const BINANCE = {
  price: `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${SYMBOL}`,
  openInterest: `https://fapi.binance.com/fapi/v1/openInterest?symbol=${SYMBOL}`,
  premiumIndex: `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${SYMBOL}`,
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [priceRes, oiRes, fundingRes] = await Promise.all([
      fetch(BINANCE.price),
      fetch(BINANCE.openInterest),
      fetch(BINANCE.premiumIndex),
    ]);

    if (!priceRes.ok || !oiRes.ok || !fundingRes.ok) {
      return res.status(502).json({ error: "Binance API error" });
    }

    const [priceData, oiData, fundingData] = await Promise.all([
      priceRes.json(),
      oiRes.json(),
      fundingRes.json(),
    ]);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json({
      price: parseFloat(priceData.price),
      oi: parseFloat(oiData.openInterest),
      fundingRate: parseFloat(fundingData.lastFundingRate),
      ts: Date.now(),
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch data" });
  }
}
