// ============ Assets Widget Functions ============

const DEFAULT_ASSET_SYMBOLS = ['^GSPC', 'GC=F', 'BTC-USD'];
const CORPORATE_ASSET_SYMBOLS = ['^GSPC', 'GC=F', '6702.T'];

function getDefaultAssets() {
  return document.body.classList.contains('corporate-user')
    ? [...CORPORATE_ASSET_SYMBOLS]
    : [...DEFAULT_ASSET_SYMBOLS];
}

let assetSymbols = [...DEFAULT_ASSET_SYMBOLS];


// Fetch asset price from Yahoo Finance
async function fetchAssetPrice(symbol) {
  try {
    console.log(`[Assets] Fetching ${symbol}...`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log(`[Assets] ${symbol} response status:`, response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`[Assets] ${symbol} error response:`, text.substring(0, 200));
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[Assets] ${symbol} data:`, data);
    
    const result = data.chart?.result?.[0];
    
    if (!result) throw new Error('No data in response');
    
    const meta = result.meta;
    
    // Get current price
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    if (!currentPrice) throw new Error('No price data');
    
    // Calculate change
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    
    // Get currency
    const currency = meta.currency || 'USD';
    
    console.log(`[Assets] ${symbol} price: ${currentPrice}, change: ${changePercent.toFixed(2)}%`);
    
    return {
      symbol: symbol,
      name: meta.shortName || symbol,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      currency: currency,
      success: true
    };
  } catch (err) {
    console.error(`[Assets] Failed to fetch ${symbol}:`, err);
    return {
      symbol: symbol,
      name: symbol,
      success: false,
      error: err.message
    };
  }
}

// Format price with appropriate decimals
function formatAssetPrice(price, currency) {
  if (price >= 10000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  } else if (price >= 100) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
}

// Render assets grid
let assetsCarouselTimer = null;
let assetsCarouselScrollListenerAdded = false;
let assetsAutoScrolling = false;

function renderAssets(assets) {
  const grid = document.getElementById('assetsGrid');
  if (!grid) return;
  
  if (!assets || assets.length === 0) {
    grid.innerHTML = `<div class="assets-loading">${t('noAssetsConfigured')}</div>`;
    stopAssetsCarousel();
    return;
  }
  
  grid.innerHTML = assets.map(asset => {
    if (!asset.success) {
      return `
        <div class="asset-item">
          <div class="asset-symbol">${asset.name}</div>
          <div class="asset-error">${t('errorLoading')}</div>
        </div>
      `;
    }
    
    const isPositive = asset.change >= 0;
    const arrow = isPositive ? '▲' : '▼';
    const changeClass = isPositive ? 'positive' : 'negative';
    const sign = isPositive ? '+' : '';
    
    const quoteUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(asset.symbol)}`;
    return `
      <a href="${quoteUrl}" target="_blank" rel="noopener" class="asset-item asset-item-link">
        <div class="asset-symbol">${asset.name}</div>
        <div class="asset-price">${formatAssetPrice(asset.price, asset.currency)}</div>
        <div class="asset-change ${changeClass}">
          <span class="arrow">${arrow}</span>
          <span>${sign}${asset.changePercent.toFixed(2)}%</span>
        </div>
      </a>
    `;
  }).join('');

  // Delay carousel start so DOM has fully laid out
  setTimeout(() => startAssetsCarousel(), 500);
}

function smoothScrollTo(el, targetLeft, duration) {
  const start = el.scrollLeft;
  const diff = targetLeft - start;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    el.scrollLeft = start + diff * ease;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function assetsCarouselTick() {
  const grid = document.getElementById('assetsGrid');
  if (!grid) return;
  const maxScroll = grid.scrollWidth - grid.clientWidth;
  console.log('[Assets Carousel] tick — scrollWidth:', grid.scrollWidth, 'clientWidth:', grid.clientWidth, 'maxScroll:', maxScroll, 'scrollLeft:', grid.scrollLeft);
  if (maxScroll <= 0) {
    scheduleNextCarouselTick();
    return;
  }
  const itemWidth = grid.querySelector('.asset-item')?.offsetWidth || 90;
  const step = itemWidth + 4;

  assetsAutoScrolling = true;
  // Snap current position to nearest column, then advance one column
  const currentCol = Math.round(grid.scrollLeft / step);
  const nextCol = currentCol + 1;
  let target = nextCol * step;

  // If already near the end, wrap to start; otherwise clamp to maxScroll
  if (grid.scrollLeft >= maxScroll - 2) {
    target = 0;
  } else if (target > maxScroll) {
    target = maxScroll;
  }
  smoothScrollTo(grid, target, 400);
  setTimeout(() => { assetsAutoScrolling = false; }, 500);

  scheduleNextCarouselTick();
}

function scheduleNextCarouselTick() {
  if (assetsCarouselTimer) clearTimeout(assetsCarouselTimer);
  assetsCarouselTimer = setTimeout(assetsCarouselTick, 5000);
}

function startAssetsCarousel() {
  stopAssetsCarousel();
  const grid = document.getElementById('assetsGrid');
  if (!grid) return;

  console.log('[Assets Carousel] start — scrollWidth:', grid.scrollWidth, 'clientWidth:', grid.clientWidth, 'items:', grid.querySelectorAll('.asset-item').length);

  // Only carousel if content overflows
  if (grid.scrollWidth <= grid.clientWidth) {
    console.log('[Assets Carousel] no overflow, skipping');
    return;
  }

  // Add scroll listener once to restart timer on manual scroll
  if (!assetsCarouselScrollListenerAdded) {
    assetsCarouselScrollListenerAdded = true;
    let userScrollTimeout;
    grid.addEventListener('scroll', () => {
      // Ignore scroll events caused by auto-scroll
      if (assetsAutoScrolling) return;
      if (userScrollTimeout) clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => {
        scheduleNextCarouselTick();
      }, 300);
    }, { passive: true });
  }

  scheduleNextCarouselTick();
}

function stopAssetsCarousel() {
  if (assetsCarouselTimer) {
    clearTimeout(assetsCarouselTimer);
    assetsCarouselTimer = null;
  }
}

// Fetch assets fresh from API
async function fetchAssetsFresh() {
  // Load saved symbols
  const saved = await new Promise(resolve => {
    chrome.storage.local.get(['assetSymbols'], resolve);
  });
  
  if (saved.assetSymbols && Array.isArray(saved.assetSymbols)) {
    assetSymbols = saved.assetSymbols;
  } else {
    assetSymbols = getDefaultAssets();
  }
  
  // Fetch all assets in parallel
  const results = await Promise.all(assetSymbols.map(fetchAssetPrice));
  setCacheData('assets', results);
  renderAssets(results);
  console.log('[Assets] Fetched and cached', results.length, 'assets');
}

// Load assets (with stale-while-revalidate caching)
async function loadAssets(forceRefresh = false) {
  const grid = document.getElementById('assetsGrid');
  if (!grid) return;
  
  // Load saved symbols first
  const saved = await new Promise(resolve => {
    chrome.storage.local.get(['assetSymbols'], resolve);
  });
  
  if (saved.assetSymbols && Array.isArray(saved.assetSymbols)) {
    assetSymbols = saved.assetSymbols;
  } else {
    assetSymbols = getDefaultAssets();
  }
  
  // Show cached data immediately if available
  if (hasCachedData('assets') && !forceRefresh) {
    const cached = getCachedData('assets');
    renderAssets(cached);
    
    // If cache is fresh, don't refetch
    if (isCacheFresh('assets')) {
      console.log('[Assets] Using fresh cache');
      return;
    }
    
    // Cache is stale, fetch in background
    console.log('[Assets] Cache stale, refreshing in background');
    fetchAssetsFresh();
    return;
  }
  
  // No cache or force refresh, show loading and fetch
  grid.innerHTML = `<div class="assets-loading">${t('loading')}</div>`;
  await fetchAssetsFresh();
}

// Initialize assets settings panel
function initAssetsSettings() {
  const settingsBtn = document.getElementById('assetsSettingsBtn');
  const panel = document.getElementById('assetsSettingsPanel');
  const saveBtn = document.getElementById('assetsSettingsSave');
  const resetBtn = document.getElementById('assetsSettingsReset');
  const symbolsInput = document.getElementById('assetsSymbolsInput');
  
  if (!settingsBtn || !panel) return;
  
  // Toggle panel
  settingsBtn.addEventListener('click', () => {
    symbolsInput.value = assetSymbols.join('\n');
    panel.classList.toggle('open');
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (panel && panel.classList.contains('open')) {
      if (!panel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
        panel.classList.remove('open');
      }
    }
  });
  
  // Save symbols
  saveBtn.addEventListener('click', async () => {
    const symbols = symbolsInput.value
      .split('\n')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
    
    if (symbols.length === 0) {
      assetSymbols = getDefaultAssets();
    } else {
      assetSymbols = symbols;
    }
    
    await chrome.storage.local.set({ assetSymbols });
    panel.classList.remove('open');
    loadAssets(true); // Force refresh when symbols change
  });
  
  // Reset to defaults
  resetBtn.addEventListener('click', async () => {
    assetSymbols = getDefaultAssets();
    await chrome.storage.local.set({ assetSymbols });
    symbolsInput.value = assetSymbols.join('\n');
    panel.classList.remove('open');
    loadAssets(true); // Force refresh when symbols change
  });
}

// Initialize assets widget
function initAssets() {
  // On page load: show cached immediately, then refresh if stale
  if (hasCachedData('assets')) {
    const cached = getCachedData('assets');
    renderAssets(cached);
    console.log('[Assets] Showing cached data on init');
  }
  
  // Always fetch fresh on page load (in background if cache exists)
  loadAssets();
  initAssetsSettings();
  
  // Refresh every 3 minutes
  setInterval(() => {
    console.log('[Assets] Auto-refresh triggered');
    fetchAssetsFresh();
  }, 3 * 60 * 1000);
}


