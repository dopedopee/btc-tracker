const STORAGE_KEY = "btc-tracker-history";
const FETCH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RECORDS = 2016; // 7 days at 5-min intervals
const SYMBOL = "BTCUSDT";

const API = {
  price: `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${SYMBOL}`,
  openInterest: `https://fapi.binance.com/fapi/v1/openInterest?symbol=${SYMBOL}`,
  premiumIndex: `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${SYMBOL}`,
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#181d28",
      borderColor: "#252b3a",
      borderWidth: 1,
      titleColor: "#e8ecf4",
      bodyColor: "#8b95a8",
      padding: 12,
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(37, 43, 58, 0.5)" },
      ticks: { color: "#8b95a8", maxTicksLimit: 8, maxRotation: 0 },
    },
    y: {
      grid: { color: "rgba(37, 43, 58, 0.5)" },
      ticks: { color: "#8b95a8" },
    },
  },
};

let history = [];
let charts = {};
let nextUpdateTimer = null;
let countdownInterval = null;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatChartLabel(ts) {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatPrice(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatOI(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatFunding(value) {
  const pct = Number(value) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(4)}%`;
}

function formatFundingAxis(value) {
  return `${(Number(value) * 100).toFixed(4)}%`;
}

function setStatus(state, text) {
  const el = document.getElementById("status");
  el.className = `status ${state}`;
  document.getElementById("status-text").textContent = text;
}

function updateUI(latest) {
  if (!latest) return;

  document.getElementById("current-price").textContent = `$${formatPrice(latest.price)}`;
  document.getElementById("current-oi").textContent = formatOI(latest.oi);
  document.getElementById("last-update").textContent = formatTime(latest.ts);

  const fundingEl = document.getElementById("current-funding");
  fundingEl.textContent = formatFunding(latest.fundingRate);
  const fundingCard = fundingEl.closest(".metric-funding");
  fundingCard.classList.remove("positive", "negative");
  fundingCard.classList.add(Number(latest.fundingRate) >= 0 ? "positive" : "negative");

  document.getElementById("record-count").textContent = `기록 ${history.length}건`;
}

function getChartLabels() {
  return history.map((r) => formatChartLabel(r.ts));
}

function createLineChart(canvasId, label, dataKey, color, yFormatter, yAxisFormatter) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, color.replace("1)", "0.25)"));
  gradient.addColorStop(1, color.replace("1)", "0)"));

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: getChartLabels(),
      datasets: [
        {
          label,
          data: history.map((r) => r[dataKey]),
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: history.length > 60 ? 0 : 3,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            ...(yAxisFormatter && { callback: yAxisFormatter }),
          },
        },
      },
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            label(ctx) {
              return yFormatter(ctx.parsed.y);
            },
          },
        },
      },
    },
  });
}

function initCharts() {
  charts.price = createLineChart(
    "price-chart",
    "가격",
    "price",
    "rgba(247, 147, 26, 1)",
    (v) => `$${formatPrice(v)}`
  );
  charts.oi = createLineChart(
    "oi-chart",
    "OI",
    "oi",
    "rgba(77, 163, 255, 1)",
    (v) => `${formatOI(v)} BTC`
  );
  charts.funding = createLineChart(
    "funding-chart",
    "펀딩비",
    "fundingRate",
    "rgba(167, 139, 250, 1)",
    (v) => formatFunding(v),
    formatFundingAxis
  );
}

function refreshCharts() {
  const labels = getChartLabels();
  const pointRadius = history.length > 60 ? 0 : 3;

  charts.price.data.labels = labels;
  charts.price.data.datasets[0].data = history.map((r) => r.price);
  charts.price.data.datasets[0].pointRadius = pointRadius;
  charts.price.update("none");

  charts.oi.data.labels = labels;
  charts.oi.data.datasets[0].data = history.map((r) => r.oi);
  charts.oi.data.datasets[0].pointRadius = pointRadius;
  charts.oi.update("none");

  charts.funding.data.labels = labels;
  charts.funding.data.datasets[0].data = history.map((r) => r.fundingRate);
  charts.funding.data.datasets[0].pointRadius = pointRadius;
  charts.funding.update("none");
}

function startCountdown(nextTs) {
  if (countdownInterval) clearInterval(countdownInterval);

  function tick() {
    const remaining = nextTs - Date.now();
    if (remaining <= 0) {
      document.getElementById("next-update").textContent = "곧 갱신...";
      return;
    }
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    document.getElementById("next-update").textContent =
      `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} 후`;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function scheduleNextFetch() {
  if (nextUpdateTimer) clearTimeout(nextUpdateTimer);
  const nextTs = Date.now() + FETCH_INTERVAL_MS;
  startCountdown(nextTs);
  nextUpdateTimer = setTimeout(fetchData, FETCH_INTERVAL_MS);
}

async function fetchData() {
  setStatus("loading", "데이터 가져오는 중...");

  try {
    const [priceRes, oiRes, fundingRes] = await Promise.all([
      fetch(API.price),
      fetch(API.openInterest),
      fetch(API.premiumIndex),
    ]);

    if (!priceRes.ok || !oiRes.ok || !fundingRes.ok) {
      throw new Error("API 응답 오류");
    }

    const [priceData, oiData, fundingData] = await Promise.all([
      priceRes.json(),
      oiRes.json(),
      fundingRes.json(),
    ]);

    const record = {
      ts: Date.now(),
      price: parseFloat(priceData.price),
      oi: parseFloat(oiData.openInterest),
      fundingRate: parseFloat(fundingData.lastFundingRate),
    };

    history.push(record);
    if (history.length > MAX_RECORDS) {
      history = history.slice(-MAX_RECORDS);
    }

    saveHistory();
    updateUI(record);
    refreshCharts();
    setStatus("ok", "정상 연결");
  } catch (err) {
    console.error(err);
    setStatus("error", "연결 실패 — 5분 후 재시도");
    if (history.length > 0) {
      updateUI(history[history.length - 1]);
    }
  }

  scheduleNextFetch();
}

function init() {
  history = loadHistory();
  initCharts();

  if (history.length > 0) {
    updateUI(history[history.length - 1]);
    refreshCharts();
    setStatus("ok", "저장된 데이터 로드됨");
  }

  fetchData();
}

init();
