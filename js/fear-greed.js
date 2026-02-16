// ============ Fear/Greed Index Widget ============

const FG_COLORS = {
  extremeFear: '#ea3943',
  fear: '#ea8c00',
  neutral: '#f5d100',
  greed: '#16c784',
  extremeGreed: '#00b061'
};

function getFgColor(score) {
  if (score <= 24) return FG_COLORS.extremeFear;
  if (score <= 44) return FG_COLORS.fear;
  if (score <= 55) return FG_COLORS.neutral;
  if (score <= 74) return FG_COLORS.greed;
  return FG_COLORS.extremeGreed;
}

function getFgRatingKey(score) {
  if (score <= 24) return 'extremeFear';
  if (score <= 44) return 'fear';
  if (score <= 55) return 'neutral';
  if (score <= 74) return 'greed';
  return 'extremeGreed';
}

function drawFearGreedGauge(container, score, prevScore) {
  if (!container) return;
  const svg = container.querySelector('.fg-arc');
  const scoreEl = container.querySelector('.fg-score');
  const ratingEl = container.querySelector('.fg-rating');
  const changeEl = container.querySelector('.fg-change');

  if (!svg) return;

  const val = parseFloat(score);
  if (isNaN(val)) return;

  const color = getFgColor(val);
  const ratingKey = getFgRatingKey(val);

  // SVG arc parameters
  const cx = 60, cy = 65, r = 48;
  const startAngle = Math.PI;       // 180 degrees (left)
  const endAngle = 0;               // 0 degrees (right)
  const arcStroke = 6;

  // Build gradient arc segments
  const segments = [
    { from: 0,   to: 0.24, color: FG_COLORS.extremeFear },
    { from: 0.24, to: 0.44, color: FG_COLORS.fear },
    { from: 0.44, to: 0.55, color: FG_COLORS.neutral },
    { from: 0.55, to: 0.74, color: FG_COLORS.greed },
    { from: 0.74, to: 1.0,  color: FG_COLORS.extremeGreed }
  ];

  let arcs = '';
  segments.forEach(seg => {
    const a1 = startAngle - seg.from * Math.PI;
    const a2 = startAngle - seg.to * Math.PI;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const large = (seg.to - seg.from) > 0.5 ? 1 : 0;
    arcs += `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}" 
      fill="none" stroke="${seg.color}" stroke-width="${arcStroke}" stroke-linecap="round" opacity="0.3"/>`;
  });

  // Active arc (filled portion up to score)
  const scoreFrac = Math.max(0, Math.min(val / 100, 1));
  const activeSegments = segments.map(seg => {
    const segStart = seg.from;
    const segEnd = Math.min(seg.to, scoreFrac);
    if (segStart >= scoreFrac) return '';
    const a1 = startAngle - segStart * Math.PI;
    const a2 = startAngle - segEnd * Math.PI;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const large = (segEnd - segStart) > 0.5 ? 1 : 0;
    return `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}" 
      fill="none" stroke="${seg.color}" stroke-width="${arcStroke}" stroke-linecap="round"/>`;
  }).join('');

  // Needle
  const needleAngle = startAngle - scoreFrac * Math.PI;
  const needleLen = r - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);
  const needleLine = `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>`;
  const needleCenter = `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}" opacity="0.4"/>`;

  svg.innerHTML = arcs + activeSegments + needleLine + needleCenter;

  // Score
  if (scoreEl) {
    scoreEl.textContent = Math.round(val);
    scoreEl.style.color = color;
  }

  // Rating
  if (ratingEl) {
    ratingEl.textContent = t(ratingKey);
    ratingEl.style.color = color;
  }

  // Daily change
  if (changeEl && prevScore !== null && prevScore !== undefined) {
    const prev = parseFloat(prevScore);
    if (!isNaN(prev)) {
      const diff = val - prev;
      const sign = diff >= 0 ? '+' : '';
      const arrow = diff >= 0 ? '▲' : '▼';
      changeEl.className = 'fg-change ' + (diff >= 0 ? 'positive' : 'negative');
      changeEl.innerHTML = `<span class="fg-arrow">${arrow}</span> ${sign}${diff.toFixed(1)}`;
    }
  }
}

async function fetchFearGreed() {
  const results = { traditional: null, crypto: null };

  // Fetch both in parallel
  const [tradRes, cryptoRes] = await Promise.allSettled([
    fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata').then(r => r.json()),
    fetch('https://api.alternative.me/fng/?limit=2').then(r => r.json())
  ]);

  // Traditional (CNN)
  if (tradRes.status === 'fulfilled' && tradRes.value?.fear_and_greed) {
    const fg = tradRes.value.fear_and_greed;
    results.traditional = {
      score: fg.score,
      rating: fg.rating,
      previousClose: fg.previous_close,
      success: true
    };
  } else {
    results.traditional = { success: false };
  }

  // Crypto (alternative.me)
  if (cryptoRes.status === 'fulfilled' && cryptoRes.value?.data?.length >= 2) {
    const today = cryptoRes.value.data[0];
    const yesterday = cryptoRes.value.data[1];
    results.crypto = {
      score: parseInt(today.value, 10),
      rating: today.value_classification,
      previousClose: parseInt(yesterday.value, 10),
      success: true
    };
  } else {
    results.crypto = { success: false };
  }

  return results;
}

function renderFearGreed(data) {
  if (!data) return;

  if (data.traditional && data.traditional.success) {
    drawFearGreedGauge(
      document.getElementById('fgTraditional'),
      data.traditional.score,
      data.traditional.previousClose
    );
  }

  if (data.crypto && data.crypto.success) {
    drawFearGreedGauge(
      document.getElementById('fgCrypto'),
      data.crypto.score,
      data.crypto.previousClose
    );
  }
}

async function fetchFearGreedFresh() {
  try {
    const data = await fetchFearGreed();
    setCacheData('fearGreed', data);
    renderFearGreed(data);
    console.log('[FearGreed] Fetched and cached');
  } catch (err) {
    console.error('[FearGreed] Fetch error:', err);
  }
}

const FG_CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

function isFgCacheFresh() {
  const cache = dataCache.fearGreed;
  if (!cache || !cache.data || !cache.timestamp) return false;
  return (Date.now() - cache.timestamp) < FG_CACHE_TTL_MS;
}

function initFearGreed() {
  // Show cached data immediately if available
  if (hasCachedData('fearGreed')) {
    const cached = getCachedData('fearGreed');
    renderFearGreed(cached);
    console.log('[FearGreed] Showing cached data on init');

    // If cache is fresh, don't refetch
    if (isFgCacheFresh()) {
      console.log('[FearGreed] Using fresh cache');
    } else {
      console.log('[FearGreed] Cache stale, refreshing in background');
      fetchFearGreedFresh();
    }
  } else {
    fetchFearGreedFresh();
  }

  // Auto-refresh every 20 minutes
  setInterval(() => {
    console.log('[FearGreed] Auto-refresh triggered');
    fetchFearGreedFresh();
  }, FG_CACHE_TTL_MS);
}

