// ============ News Functions ============

let newsItems = [];
let currentNewsIndex = 0;
let newsRotationInterval = null;

// Format years ago label
function formatYearsAgo(years) {
  if (years === 0) return t('thisDayInHistory');
  if (years === 1) return t('yearAgo');
  return t('yearsAgo').replace('{n}', years);
}

// Fetch historical events from Wikipedia API
// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchHistoryEvents() {
  if (document.body.classList.contains('corporate-user')) {
    return fetchCorporateEvents();
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Parse and limit to 10 events
    const events = (data.events || []).slice(0, 10).map(event => {
      const year = event.year;
      const yearsAgo = now.getFullYear() - year;
      const title = event.text || 'Historical event';
      const url = event.pages?.[0]?.content_urls?.desktop?.page || null;
      const image = event.pages?.[0]?.thumbnail?.source || null;
      
      return {
        id: `history-${year}`,
        title,
        year,
        yearsAgo,
        url,
        image
      };
    });
    
    // Shuffle events randomly (order preserved in cache until midnight)
    const shuffled = shuffleArray(events);
    
    return shuffled;
  } catch (error) {
    console.error('[History] Fetch error:', error);
    return [];
  }
}

// Fetch corporate press releases from Fujitsu RSS feed
async function fetchCorporateEvents() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rssUrl = `https://fujitsu-on-day.flp.studio/rss?date=${month}-${day}`;

  try {
    const response = await fetch(rssUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xmlText = await response.text();
    const { items } = parseRssFeed(xmlText);

    const events = items.map((item, index) => {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      const year = pubDate ? pubDate.getFullYear() : now.getFullYear();
      const yearsAgo = now.getFullYear() - year;

      return {
        id: `corporate-${index}`,
        title: item.title,
        year,
        yearsAgo,
        url: item.url,
        image: null
      };
    });

    return shuffleArray(events);
  } catch (error) {
    console.error('[History] Corporate RSS fetch error:', error);
    return [];
  }
}

// Cache is valid until midnight (end of day)
function isHistoryCacheFresh() {
  const cache = dataCache['history'];
  if (!cache || !cache.data) return false;
  
  // Cache is fresh if timestamp is from today (before midnight)
  const cacheDate = new Date(cache.timestamp);
  const now = new Date();
  
  return (
    cacheDate.getFullYear() === now.getFullYear() &&
    cacheDate.getMonth() === now.getMonth() &&
    cacheDate.getDate() === now.getDate()
  );
}

async function loadHistoryFresh() {
  console.log('[History] Fetching fresh data...');
  const events = await fetchHistoryEvents();
  if (events && events.length > 0) {
    setCacheData('history', events);
    console.log('[History] Cached', events.length, 'events');
  }
  return events;
}

async function loadHistory() {
  // Show cached data immediately if available
  if (hasCachedData('history')) {
    const cached = getCachedData('history');
    newsItems = cached;
    
    // Restore saved position
    chrome.storage.local.get(['historyIndex'], (result) => {
      if (result.historyIndex !== undefined && result.historyIndex < newsItems.length) {
        currentNewsIndex = result.historyIndex;
      } else {
        currentNewsIndex = 0;
      }
      renderNewsItem();
      startNewsRotation();
    });
    
    console.log('[History] Showing cached data');
    
    // If cache is fresh, don't refetch
    if (isHistoryCacheFresh()) {
      console.log('[History] Using fresh cache');
      return;
    }
    
    // Cache is stale, fetch in background
    console.log('[History] Cache stale, refreshing in background');
    loadHistoryFresh().then(events => {
      if (events && events.length > 0) {
        newsItems = events;
        currentNewsIndex = 0;
        renderNewsItem();
        startNewsRotation();
      }
    });
    return;
  }
  
  // No cache, fetch and wait
  const events = await loadHistoryFresh();
  newsItems = events;
  currentNewsIndex = 0;
  renderNewsItem();
  startNewsRotation();
}

// Render 2 history items
function renderNewsItem() {
  const content = document.getElementById('newsTickerContent');
  
  if (!newsItems || newsItems.length === 0) {
    content.innerHTML = `<span class="news-empty">${t('noNewsEvents')}</span>`;
    return;
  }
  
  // Get current 2 items
  const item1 = newsItems[currentNewsIndex];
  const item2 = newsItems.length > 1 ? newsItems[(currentNewsIndex + 1) % newsItems.length] : null;
  
  const isCorporate = document.body.classList.contains('corporate-user');

  const buildItemHtml = (item) => {
    const yearsAgoText = formatYearsAgo(item.yearsAgo);
    const corporateOverlay = isCorporate ? '<img src="icons/fujitsu.png" alt="" class="news-item-corp-icon">' : '';
    const visualHtml = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="" class="news-item-image">`
      : `<div class="news-item-year">${item.year}${corporateOverlay}</div>`;

    const wrapperTag = item.url ? 'a' : 'div';
    const wrapperAttrs = item.url ? `href="${escapeHtml(item.url)}" target="_blank"` : '';

    return `
      <${wrapperTag} class="news-item" ${wrapperAttrs}>
        <div class="news-item-visual">${visualHtml}</div>
        <div class="news-item-content">
          <div class="news-item-date">${yearsAgoText}</div>
          <div class="news-item-title">${escapeHtml(item.title)}</div>
        </div>
      </${wrapperTag}>
    `;
  };
  
  content.innerHTML = `
    <div class="news-items-row">
      ${buildItemHtml(item1)}
      ${item2 ? buildItemHtml(item2) : ''}
    </div>
  `;
}

// Rotate to next pair of history items
function rotateNews() {
  if (newsItems.length === 0) return;
  
  // Advance by 2 items (showing 2 at a time)
  currentNewsIndex = (currentNewsIndex + 2) % newsItems.length;
  renderNewsItem();
  
  // Persist position
  chrome.storage.local.set({ historyIndex: currentNewsIndex });
}

// Start news rotation
function startNewsRotation() {
  if (newsRotationInterval) {
    clearInterval(newsRotationInterval);
  }
  newsRotationInterval = setInterval(rotateNews, 60000); // 60 seconds (1 minute)
}

// Initialize news ticker
function initNews() {
  loadHistory();
  
  // Schedule refresh at midnight
  function scheduleNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    console.log(`[History] Next refresh in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at midnight)`);
    
    setTimeout(() => {
      loadHistory();
      scheduleNextMidnight(); // Schedule next midnight
    }, msUntilMidnight);
  }
  
  scheduleNextMidnight();
}


