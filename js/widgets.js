// ============ System Stats Widget ============

let lastCpuInfo = null;

// Get CPU usage percentage
async function getCpuUsage() {
  return new Promise((resolve) => {
    if (!chrome.system || !chrome.system.cpu) {
      resolve(null);
      return;
    }
    
    chrome.system.cpu.getInfo((info) => {
      if (!info || !info.processors) {
        resolve(null);
        return;
      }
      
      if (!lastCpuInfo) {
        lastCpuInfo = info;
        resolve(null);
        return;
      }
      
      let totalUsage = 0;
      const numProcessors = info.processors.length;
      
      for (let i = 0; i < numProcessors; i++) {
        const curr = info.processors[i].usage;
        const prev = lastCpuInfo.processors[i].usage;
        
        const totalDiff = curr.total - prev.total;
        const idleDiff = curr.idle - prev.idle;
        
        if (totalDiff > 0) {
          const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
          totalUsage += usage;
        }
      }
      
      lastCpuInfo = info;
      resolve(Math.round(totalUsage / numProcessors));
    });
  });
}

// Get memory usage percentage
async function getMemoryUsage() {
  return new Promise((resolve) => {
    if (!chrome.system || !chrome.system.memory) {
      resolve(null);
      return;
    }
    
    chrome.system.memory.getInfo((info) => {
      if (!info) {
        resolve(null);
        return;
      }
      
      const used = info.capacity - info.availableCapacity;
      const percentage = Math.round((used / info.capacity) * 100);
      const usedGB = (used / (1024 * 1024 * 1024)).toFixed(1);
      const totalGB = (info.capacity / (1024 * 1024 * 1024)).toFixed(1);
      
      resolve({
        percentage,
        usedGB,
        totalGB
      });
    });
  });
}

// Get battery level
async function getBatteryInfo() {
  try {
    if (!navigator.getBattery) {
      return null;
    }
    
    const battery = await navigator.getBattery();
    return {
      level: Math.round(battery.level * 100),
      charging: battery.charging
    };
  } catch (e) {
    return null;
  }
}


// Update stat display
function updateStatDisplay(fillEl, valueEl, statEl, percentage, tooltip, isCharging = false) {
  if (percentage === null || percentage === undefined) {
    valueEl.textContent = 'N/A';
    fillEl.style.width = '0%';
    return;
  }
  
  valueEl.textContent = `${percentage}%`;
  fillEl.style.width = `${percentage}%`;
  
  // Remove existing state classes
  fillEl.classList.remove('warning', 'critical', 'charging');
  
  // Add appropriate class based on level
  if (isCharging) {
    fillEl.classList.add('charging');
  } else if (percentage > 80) {
    fillEl.classList.add('critical');
  } else if (percentage > 60) {
    fillEl.classList.add('warning');
  }
  
  if (tooltip) {
    statEl.title = tooltip;
  }
}

// Update all system stats
async function updateSystemStats() {
  // CPU
  const cpuUsage = await getCpuUsage();
  const cpuFill = document.getElementById('cpuFill');
  const cpuValue = document.getElementById('cpuValue');
  const cpuStat = document.getElementById('cpuStat');
  if (cpuFill && cpuValue && cpuStat) {
    const tooltip = t('cpuUsageTooltip').replace('{percent}', cpuUsage ?? 'N/A');
    updateStatDisplay(cpuFill, cpuValue, cpuStat, cpuUsage, tooltip);
  }
  
  // Memory
  const memInfo = await getMemoryUsage();
  const memFill = document.getElementById('memFill');
  const memValue = document.getElementById('memValue');
  const memStat = document.getElementById('memStat');
  if (memFill && memValue && memStat && memInfo) {
    const tooltip = t('memoryTooltip').replace('{used}', memInfo.usedGB).replace('{total}', memInfo.totalGB);
    updateStatDisplay(memFill, memValue, memStat, memInfo.percentage, tooltip);
  }
  
  // Battery
  const batteryInfo = await getBatteryInfo();
  const batteryFill = document.getElementById('batteryFill');
  const batteryValue = document.getElementById('batteryValue');
  const batteryStat = document.getElementById('batteryStat');
  if (batteryFill && batteryValue && batteryStat) {
    if (batteryInfo) {
      // For battery, low is critical (inverse logic)
      batteryFill.classList.remove('warning', 'critical', 'charging');
      batteryValue.textContent = `${batteryInfo.level}%`;
      batteryFill.style.width = `${batteryInfo.level}%`;
      
      if (batteryInfo.charging) {
        batteryFill.classList.add('charging');
        batteryStat.title = t('batteryCharging').replace('{percent}', batteryInfo.level);
      } else if (batteryInfo.level < 20) {
        batteryFill.classList.add('critical');
        batteryStat.title = t('batteryLow').replace('{percent}', batteryInfo.level);
      } else if (batteryInfo.level < 40) {
        batteryFill.classList.add('warning');
        batteryStat.title = t('batteryTooltip').replace('{percent}', batteryInfo.level);
      } else {
        batteryStat.title = t('batteryTooltip').replace('{percent}', batteryInfo.level);
      }
    } else {
      // No battery (desktop)
      batteryStat.style.display = 'none';
    }
  }
  
}

// Initialize system stats
function initSystemStats() {
  // Initial update (need to call twice for CPU to get diff)
  updateSystemStats();
  setTimeout(updateSystemStats, 1000);
  
  // Update every 3 seconds
  setInterval(updateSystemStats, 3000);
}


// ============ Hacker News Widget ============

async function fetchHackerNews() {
  try {
    const idsResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!idsResponse.ok) throw new Error('HN API error');
    const ids = await idsResponse.json();
    const top10 = ids.slice(0, 50);

    const stories = await Promise.all(
      top10.map(async (id) => {
        try {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          return await res.json();
        } catch {
          return null;
        }
      })
    );

    return stories.filter(Boolean);
  } catch (err) {
    console.warn('[HN] Fetch failed:', err);
    return null;
  }
}

let hnStories = [];
let hnCurrentIndex = 0;
let hnRotateTimer = null;
const HN_VISIBLE_COUNT = 3;
const HN_ROTATE_INTERVAL = 40 * 1000; // 40 seconds

function formatHnDate(unixTime) {
  if (!unixTime) return '';
  const d = new Date(unixTime * 1000);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d`;
}

function buildHnTrackHtml(stories, startIndex) {
  let html = '';
  for (let i = 0; i < HN_VISIBLE_COUNT; i++) {
    const story = stories[(startIndex + i) % stories.length];
    if (!story) break;
    const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    const age = formatHnDate(story.time);
    html += `<a class="hn-item" href="${url}" target="_blank" rel="noopener" title="${story.title}">
      <span class="hn-score">${story.score}</span>
      <span class="hn-item-title">${story.title}</span>
      <span class="hn-date">${age}</span>
    </a>`;
  }
  return html;
}

function renderHackerNews(stories) {
  const list = document.getElementById('hnList');
  if (!list) return;

  if (!stories || stories.length === 0) {
    list.innerHTML = `<div class="hn-loading">${t('noStoriesAvailable')}</div>`;
    return;
  }

  hnStories = stories;
  hnCurrentIndex = 0;

  // Show first 3 stories in a track
  list.innerHTML = `<div class="hn-track">${buildHnTrackHtml(hnStories, hnCurrentIndex)}</div>`;

  // Start rotation
  startHnRotation();
}

function rotateHackerNews() {
  if (hnStories.length <= HN_VISIBLE_COUNT) return;

  const list = document.getElementById('hnList');
  if (!list) return;

  const nextIndex = (hnCurrentIndex + 1) % hnStories.length;

  // Create new incoming track
  const newTrack = document.createElement('div');
  newTrack.className = 'hn-track hn-track-incoming';
  newTrack.innerHTML = buildHnTrackHtml(hnStories, nextIndex);

  // Mark current track as outgoing
  const currentTrack = list.querySelector('.hn-track');
  if (currentTrack) {
    currentTrack.classList.add('hn-track-outgoing');
  }
  list.appendChild(newTrack);

  // After animation, clean up
  setTimeout(() => {
    hnCurrentIndex = nextIndex;
    if (currentTrack) currentTrack.remove();
    newTrack.classList.remove('hn-track-incoming');
  }, 500);
}

function startHnRotation() {
  if (hnRotateTimer) clearInterval(hnRotateTimer);
  if (hnStories.length > HN_VISIBLE_COUNT) {
    hnRotateTimer = setInterval(rotateHackerNews, HN_ROTATE_INTERVAL);
  }
}

function initHackerNews() {
  // Show cached data immediately
  if (hasCachedData('hn')) {
    const cached = getCachedData('hn');
    renderHackerNews(cached);
    console.log('[HN] Showing cached stories');
  }

  // Fetch fresh if cache is stale
  if (!isCacheFresh('hn')) {
    fetchHackerNews().then(stories => {
      if (stories) {
        setCacheData('hn', stories);
        renderHackerNews(stories);
        console.log('[HN] Fetched fresh stories');
      }
    });
  }

  // Auto-refresh every 10 minutes
  setInterval(() => {
    fetchHackerNews().then(stories => {
      if (stories) {
        setCacheData('hn', stories);
        renderHackerNews(stories);
      }
    });
  }, 10 * 60 * 1000);
}


// ============ Daily Quote Functions ============

// QuoteSlate API - 2,600+ curated quotes with CORS support
const QUOTE_API_URL = 'https://quoteslate.vercel.app/api/quotes/random';
const QUOTE_CACHE_KEY = 'dailyQuote';

// Get today's date key for caching
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

// Fetch a random quote from QuoteSlate API
async function fetchQuote() {
  try {
    const response = await fetch(QUOTE_API_URL);
    if (!response.ok) throw new Error('Failed to fetch quote');
    const data = await response.json();
    return {
      text: data.quote,
      author: data.author
    };
  } catch (e) {
    console.error('Quote fetch error:', e);
    return null;
  }
}

// Get quote for today (cached per day)
async function getDailyQuote() {
  const todayKey = getTodayKey();
  
  return new Promise((resolve) => {
    chrome.storage.local.get([QUOTE_CACHE_KEY], async (result) => {
      const cached = result[QUOTE_CACHE_KEY];
      
      // Use cached quote if it's from today
      if (cached && cached.dateKey === todayKey) {
        resolve(cached.quote);
        return;
      }
      
      // Fetch new quote
      const quote = await fetchQuote();
      
      // Cache the quote for today
      chrome.storage.local.set({
        [QUOTE_CACHE_KEY]: {
          dateKey: todayKey,
          quote: quote
        }
      });
      
      resolve(quote);
    });
  });
}

// Render the quote in chat (if chat is empty)
function renderQuoteInChat(quote) {
  // Only render if chat is empty
  if (chatHistory.length > 0) return;
  
  const messagesContainer = document.getElementById('aiChatMessages');
  if (!messagesContainer || !quote) return;
  
  messagesContainer.innerHTML = `
    <div class="chat-mantra">
      <div class="chat-mantra-text">${quote.text}</div>
      <div class="chat-mantra-author">— ${quote.author}</div>
    </div>
  `;
}

// Refresh quote (fetch new one)
async function refreshQuote() {
  const quote = await fetchQuote();
  
  // Save the new quote
  chrome.storage.local.set({
    [QUOTE_CACHE_KEY]: {
      dateKey: getTodayKey(),
      quote: quote
    }
  });
  
  renderQuoteInChat(quote);
}

// Check if day has changed and refresh quote if needed
let lastQuoteDateKey = null;

async function checkDailyQuoteRefresh() {
  const todayKey = getTodayKey();
  if (lastQuoteDateKey && lastQuoteDateKey !== todayKey) {
    // Day has changed, fetch new quote
    const quote = await getDailyQuote();
    renderQuoteInChat(quote);
  }
  lastQuoteDateKey = todayKey;
}

// Initialize daily quote
async function initDailyQuote() {
  // Pre-fetch the quote so it's cached
  await getDailyQuote();
  lastQuoteDateKey = getTodayKey();
  
  // Check for day change every minute (in case tab stays open overnight)
  setInterval(checkDailyQuoteRefresh, 60000);
}


// ============ Popular Sites Functions ============

// Get top sites using Chrome's topSites API
async function getPopularSites() {
  return new Promise((resolve) => {
    // Try topSites API first (most reliable)
    if (typeof chrome !== 'undefined' && chrome.topSites) {
      chrome.topSites.get((sites) => {
        if (chrome.runtime.lastError) {
          console.error('TopSites error:', chrome.runtime.lastError);
          resolve([]);
          return;
        }
        
        if (!sites || sites.length === 0) {
          console.log('No top sites found');
          resolve([]);
          return;
        }
        
        console.log('Top sites fetched:', sites.length);
        
        // Map to our format, limit to 15 (5x3 grid)
        const mapped = sites.slice(0, 15).map(site => {
          try {
            const url = new URL(site.url);
            const domain = url.hostname.replace(/^www\./, '');
            return {
              domain: domain,
              url: site.url,
              title: site.title || domain
            };
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        
        resolve(mapped);
      });
    } else {
      console.log('chrome.topSites not available');
      resolve([]);
    }
  });
}

// Get favicon URL for a domain
function getFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// Get first letter for fallback
function getFirstLetter(domain) {
  return domain.charAt(0).toUpperCase();
}

// Popular news sites list (15 sites)
const NEWS_SITES = [
  { name: 'Reuters', url: 'https://www.reuters.com/', domain: 'reuters.com' },
  { name: 'BBC News', url: 'https://www.bbc.com/news', domain: 'bbc.com' },
  { name: 'CNN', url: 'https://www.cnn.com/', domain: 'cnn.com' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/', domain: 'theguardian.com' },
  { name: 'AP News', url: 'https://apnews.com/', domain: 'apnews.com' },
  { name: 'Bloomberg', url: 'https://www.bloomberg.com/', domain: 'bloomberg.com' },
  { name: 'Financial Times', url: 'https://www.ft.com/', domain: 'ft.com' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/', domain: 'techcrunch.com' },
  { name: 'The Verge', url: 'https://www.theverge.com/', domain: 'theverge.com' },
  { name: 'Ars Technica', url: 'https://arstechnica.com/', domain: 'arstechnica.com' },
  { name: 'Wired', url: 'https://www.wired.com/', domain: 'wired.com' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/', domain: 'ycombinator.com' },
  { name: 'NHK World', url: 'https://www3.nhk.or.jp/nhkworld/', domain: 'nhk.or.jp' },
  { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/', domain: 'nikkei.com' },
  { name: 'Fujitsu News', url: 'https://www.fujitsu.com/global/about/resources/news/', domain: 'fujitsu.com' }
];

const SITES_TAB_STORAGE_KEY = 'sitesTabSelection';
let currentSitesTab = 'topSites';

// Render sites grid (works for all tabs)
function renderSitesGrid(sites, emptyMessage) {
  const grid = document.getElementById('popularSitesGrid');
  if (!grid) return;
  
  if (sites.length === 0) {
    grid.innerHTML = `<div class="popular-sites-empty">${emptyMessage}</div>`;
    return;
  }
  
  grid.innerHTML = sites.map(site => `
    <a href="${escapeHtml(site.url)}" class="popular-site-item" title="${escapeHtml(site.name || site.domain)}">
      <div class="popular-site-favicon">
        <img src="${getFaviconUrl(site.domain)}" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
             alt="">
        <span class="site-letter" style="display:none;">${getFirstLetter(site.domain)}</span>
      </div>
      <span class="popular-site-name">${escapeHtml(site.name || site.domain)}</span>
    </a>
  `).join('');
}

// Load top sites
async function loadTopSites() {
  const grid = document.getElementById('popularSitesGrid');
  if (grid) {
    grid.innerHTML = `<div class="popular-sites-loading">${t('loading')}</div>`;
  }
  
  try {
    const sites = await getPopularSites();
    renderSitesGrid(sites, t('noBrowsingHistory'));
  } catch (e) {
    console.error('Failed to load popular sites:', e);
    if (grid) {
      grid.innerHTML = `<div class="popular-sites-empty">${t('failedLoadHistory')}</div>`;
    }
  }
}

// Recursively collect bookmarks from a tree node
function collectBookmarksFromTree(nodes, collected = []) {
  for (const node of nodes) {
    if (node.url && !node.url.startsWith('javascript:')) {
      // It's a bookmark with a URL
      collected.push(node);
    }
    
    if (node.children) {
      // It's a folder, recurse into it
      collectBookmarksFromTree(node.children, collected);
    }
  }
  return collected;
}

// Load bookmarks
async function loadBookmarks() {
  const grid = document.getElementById('popularSitesGrid');
  if (grid) {
    grid.innerHTML = `<div class="popular-sites-loading">${t('loading')}</div>`;
  }
  
  try {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      // Get all bookmarks from the tree
      let bookmarks = [];
      try {
        const tree = await chrome.bookmarks.getTree();
        if (tree && tree.length > 0) {
          // tree[0] is the root, its children are "Bookmarks Bar", "Other Bookmarks", etc.
          bookmarks = collectBookmarksFromTree(tree, []);
          console.log('Got', bookmarks.length, 'bookmarks from tree');
        }
      } catch (treeError) {
        console.log('Could not get bookmarks tree:', treeError);
      }
      
      if (!bookmarks || !Array.isArray(bookmarks) || bookmarks.length === 0) {
        console.log('No bookmarks found');
        renderSitesGrid([], t('noBookmarks'));
        return;
      }
      
      const sites = bookmarks
        .filter(b => b.url && !b.url.startsWith('javascript:'))
        .map(b => {
          try {
            const url = new URL(b.url);
            return { name: b.title || url.hostname, url: b.url, domain: url.hostname };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
      
      console.log('Loaded bookmarks:', sites.length, sites);
      renderSitesGrid(sites, t('noBookmarks'));
    } else {
      console.log('chrome.bookmarks API not available');
      renderSitesGrid([], t('noBookmarks'));
    }
  } catch (e) {
    console.error('Failed to load bookmarks:', e);
    renderSitesGrid([], t('noBookmarks'));
  }
}

// Load news sites
function loadNewsSites() {
  const sites = NEWS_SITES.map(site => ({
    name: site.name,
    url: site.url,
    domain: site.domain
  }));
  renderSitesGrid(sites, t('noContentAvailable'));
}

// Switch tabs
function switchSitesTab(tabName) {
  currentSitesTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('.sites-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Save selection
  chrome.storage.local.set({ [SITES_TAB_STORAGE_KEY]: tabName });
  
  // Load content
  if (tabName === 'topSites') {
    loadTopSites();
  } else if (tabName === 'bookmarks') {
    loadBookmarks();
  } else if (tabName === 'news') {
    loadNewsSites();
  }
}

// Initialize popular sites with tabs
function initPopularSites() {
  // Add tab click handlers
  document.querySelectorAll('.sites-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchSitesTab(tab.dataset.tab);
    });
  });
  
  // Load saved tab selection
  chrome.storage.local.get([SITES_TAB_STORAGE_KEY], (result) => {
    const savedTab = result[SITES_TAB_STORAGE_KEY] || 'topSites';
    switchSitesTab(savedTab);
  });
}


// ============ Sounds Functions ============

// SVG icon paths for sounds (24x24 viewBox)
const SOUND_ICONS = {
  // Nature
  rain: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 0" fill="none"/><path d="M7 13l1.5 3M10 11l1.5 3M13 13l1.5 3M16 11l1.5 3M8.5 8l1.5 3M11.5 6l1.5 3M14.5 8l1.5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  ocean: '<path d="M2 16c1.5-1.5 3-2 4.5-.5S9.5 17.5 11 16s3-2 4.5-.5 3 2 4.5.5M2 12c1.5-1.5 3-2 4.5-.5S9.5 13.5 11 12s3-2 4.5-.5 3 2 4.5.5M2 20c1.5-1.5 3-2 4.5-.5S9.5 21.5 11 20s3-2 4.5-.5 3 2 4.5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  wind: '<path d="M3 8h10a2 2 0 1 0-2-2M3 12h14a2 2 0 1 1-2 2M3 16h8a2 2 0 1 0-2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  fire: '<path d="M12 22c-4 0-7-2.7-7-7 0-3.5 2.5-6.5 4-8 .3 2 1.5 3 3 3 1.2 0 2.2-.8 2.5-2 2 2.5 4.5 4.5 4.5 7 0 4.3-3 7-7 7z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-1.5 1-2.5 2-3.5.5 1 1.2 1.5 2 1.5s1.3-.3 1.5-1c.8 1 1.5 1.8 1.5 3 0 1.8-1.3 3-4 3z" stroke="currentColor" stroke-width="1.2" fill="none"/>',
  stream: '<path d="M4 6c2 0 3 2 5 2s3-2 5-2 3 2 5 2M4 12c2 0 3 2 5 2s3-2 5-2 3 2 5 2M4 18c2 0 3 2 5 2s3-2 5-2 3 2 5 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  thunder: '<path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
  birds: '<path d="M4 10c2-3 4-4 6-2M4 10c1 1 3 0 4-1M14 7c2-3 4-3 6-1M14 7c1 1 3 1 4 0M8 16c2-2 3-2 5-1M8 16c1 1 2 0 3 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  crickets: '<path d="M6 12h2M10 10h1.5M10 14h1.5M16 12h2M14 9l1.5 1M14 15l1.5-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>',
  waves: '<path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M2 11c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.5"/>',
  // Ambient
  whitenoise: '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M7 8v8M10 6v12M13 9v6M16 7v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  pinknoise: '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M7 10v4M10 8v8M13 11v2M16 9v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  brownnoise: '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M7 11v2M10 9v6M13 10v4M16 8v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  binaural: '<path d="M3 18V6a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M21 18V6a5 5 0 0 0-5-5h0a5 5 0 0 0-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><rect x="1" y="16" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="19" y="16" width="4" height="6" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  drone: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  space: '<circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="5" cy="5" r="1" fill="currentColor"/><circle cx="19" cy="8" r="1.2" fill="currentColor"/><circle cx="7" cy="18" r="0.8" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/><circle cx="15" cy="4" r="0.6" fill="currentColor"/><path d="M3 12a9 9 0 0 0 18 0" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" fill="none"/>',
  chimes: '<path d="M8 2v14M12 2v16M16 2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="17" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/><circle cx="16" cy="15" r="1.5" fill="currentColor"/><path d="M5 2h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  hum: '<ellipse cx="12" cy="12" rx="9" ry="6" stroke="currentColor" stroke-width="1.6" fill="none"/><ellipse cx="12" cy="12" rx="5" ry="3" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  shimmer: '<path d="M12 2l1 4-1 4 1 4-1 4 1 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M7 4l1 3-1 3 1 3-1 3 1 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/><path d="M17 5l1 3-1 3 1 3-1 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/>',
  // Zen ambient
  singingbowl: '<circle cx="12" cy="14" r="8" stroke="currentColor" stroke-width="1.6" fill="none"/><ellipse cx="12" cy="14" rx="8" ry="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M12 6v-3M10 4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  waterfall: '<path d="M4 4v6c0 2 2 4 4 4h8c2 0 4-2 4-4V4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M8 14v4M12 14v6M16 14v3M10 14v5M14 14v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>',
  heartbeat: '<path d="M3 12h3l2-4 3 8 3-8 2 4h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/>',
  breath: '<path d="M12 3c-3 3-5 6-5 9s2 6 5 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M12 3c3 3 5 6 5 9s-2 6-5 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M12 8v8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>',
  cavedrip: '<path d="M4 6c2-2 5-3 8-3s6 1 8 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M6 6v10M18 6v10M6 16c2 2 5 3 6 3s4-1 6-3" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="10" r="1" fill="currentColor"/><path d="M12 11v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  bamboo: '<path d="M8 2v20M16 2v20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 7h8M8 12h8M8 17h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/><path d="M5 22l3-3M16 22l3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  gong: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.2" fill="none" opacity="0.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M21 5l-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  lullaby: '<path d="M9 6a3 3 0 1 1 6 0" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 10c0 5 2 8 4 10 2-2 4-5 4-10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="6" cy="14" r="1" fill="currentColor" opacity="0.5"/><circle cx="18" cy="12" r="1" fill="currentColor" opacity="0.5"/><circle cx="5" cy="8" r="0.8" fill="currentColor" opacity="0.3"/>',
  zengarden: '<circle cx="12" cy="16" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M3 20c3-1 6-1 9-1s6 0 9 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/><path d="M3 18c4 0 7-1 9-4 2 3 5 4 9 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.4"/><path d="M7 7v-4M10 5v-2M13 6v-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>',
  // Tones
  om: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 7v10M8 9.5c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5M8 14.5c0 1.4 1.8 2.5 4 2.5s4-1.1 4-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
  hz174: '<path d="M2 12h5l2.5-3 5 6 2.5-3h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  hz285: '<path d="M2 12h4l2-4 4 8 4-8 2 4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  hz396: '<path d="M2 12h3l2-5 3 10 3-10 2 5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 4" fill="none"/>',
  hz432: '<path d="M2 12h4l2-6 3 12 3-12 2 6h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" fill="none"/>',
  hz528: '<path d="M2 12h4l2-5 3 10 3-10 2 5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  hz639: '<path d="M2 12h3l2-4 2.5 8 2.5-8 2.5 8 2.5-8 2 4h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  hz741: '<path d="M2 12h2l1.5-3 2 6 2-6 2 6 2-6 2 6 1.5-3h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  hz852: '<path d="M2 12h1.5l1-2 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1.5-4 1.5 4 1-2h1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
};

// Radio SVG icons
SOUND_ICONS.radio = '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="currentColor"/><path class="radio-wave radio-wave-1" d="M7.05 7.05a7 7 0 0 0 0 9.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path class="radio-wave radio-wave-1" d="M16.95 7.05a7 7 0 0 1 0 9.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path class="radio-wave radio-wave-2" d="M4.22 4.22a11 11 0 0 0 0 15.56" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path class="radio-wave radio-wave-2" d="M19.78 4.22a11 11 0 0 1 0 15.56" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
SOUND_ICONS.radioSearch = '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
SOUND_ICONS.more = '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>';

// Radio presets (SomaFM)
const RADIO_PRESETS = [
  { id: 'soma-groovesalad', name: 'Groove Salad', description: 'Ambient/downtempo beats', streamUrl: 'https://ice4.somafm.com/groovesalad-128-mp3', source: 'SomaFM' },
  { id: 'soma-dronezone', name: 'Drone Zone', description: 'Atmospheric ambient textures', streamUrl: 'https://ice4.somafm.com/dronezone-128-mp3', source: 'SomaFM' },
  { id: 'soma-lush', name: 'Lush', description: 'Sensuous mellow vocals', streamUrl: 'https://ice4.somafm.com/lush-128-mp3', source: 'SomaFM' },
  { id: 'soma-spacestation', name: 'Space Station Soma', description: 'Mid-tempo space electronica', streamUrl: 'https://ice4.somafm.com/spacestation-128-mp3', source: 'SomaFM' },
  { id: 'soma-defcon', name: 'DEF CON Radio', description: 'Music for hacking', streamUrl: 'https://ice4.somafm.com/defcon-128-mp3', source: 'SomaFM' },
  { id: 'soma-illstreet', name: 'Illinois Street Lounge', description: 'Lounge & exotica', streamUrl: 'https://ice4.somafm.com/illstreet-128-mp3', source: 'SomaFM' },
  { id: 'soma-indiepop', name: 'Indie Pop Rocks!', description: 'Indie pop favorites', streamUrl: 'https://ice4.somafm.com/indiepop-128-mp3', source: 'SomaFM' },
  { id: 'soma-u80s', name: 'Underground 80s', description: '80s synthpop & new wave', streamUrl: 'https://ice4.somafm.com/u80s-128-mp3', source: 'SomaFM' },
  { id: 'soma-folkfwd', name: 'Folk Forward', description: 'Indie folk & alt-folk', streamUrl: 'https://ice4.somafm.com/folkfwd-128-mp3', source: 'SomaFM' }
];

// Radio state
let radioAudio = null;
let currentRadioStation = null;
let radioRecentStations = [];
let radioSearchResults = [];
let radioSearchTimeout = null;
let radioPanelOpen = false;
let radioSearching = false;
let radioSearchDone = false;
let radioRecentExpanded = false;
let radioHighlightIndex = -1;
let radioBuffering = false;
const RADIO_RECENT_COLLAPSED = 5;
const RADIO_RECENT_MAX = 50;

// Sound data - uses Web Audio API for generated sounds
const SOUNDS_DATA = {
  nature: [
    { id: 'rain', i18nKey: 'soundRain', icon: 'rain', generator: 'rain' },
    { id: 'ocean', i18nKey: 'soundOcean', icon: 'ocean', generator: 'ocean' },
    { id: 'wind', i18nKey: 'soundWind', icon: 'wind', generator: 'wind' },
    { id: 'fire', i18nKey: 'soundFire', icon: 'fire', generator: 'fire' },
    { id: 'stream', i18nKey: 'soundStream', icon: 'stream', generator: 'stream' },
    { id: 'thunder', i18nKey: 'soundThunder', icon: 'thunder', generator: 'thunder' },
    { id: 'birds', i18nKey: 'soundBirds', icon: 'birds', generator: 'birds' },
    { id: 'crickets', i18nKey: 'soundCrickets', icon: 'crickets', generator: 'crickets' },
    { id: 'waves', i18nKey: 'soundWaves', icon: 'waves', generator: 'waves' }
  ],
  zen: [
    { id: 'singingbowl', i18nKey: 'soundSingingBowl', icon: 'singingbowl', generator: 'singingbowl' },
    { id: 'waterfall', i18nKey: 'soundWaterfall', icon: 'waterfall', generator: 'waterfall' },
    { id: 'heartbeat', i18nKey: 'soundHeartbeat', icon: 'heartbeat', generator: 'heartbeat' },
    { id: 'breath', i18nKey: 'soundBreath', icon: 'breath', generator: 'breath' },
    { id: 'cavedrip', i18nKey: 'soundCaveDrip', icon: 'cavedrip', generator: 'cavedrip' },
    { id: 'bamboo', i18nKey: 'soundBamboo', icon: 'bamboo', generator: 'bamboo' },
    { id: 'gong', i18nKey: 'soundGong', icon: 'gong', generator: 'gong' },
    { id: 'lullaby', i18nKey: 'soundLullaby', icon: 'lullaby', generator: 'lullaby' },
    { id: 'zengarden', i18nKey: 'soundZenGarden', icon: 'zengarden', generator: 'zengarden' }
  ],
  ambient: [
    { id: 'whitenoise', i18nKey: 'soundWhiteNoise', icon: 'whitenoise', generator: 'whitenoise' },
    { id: 'pinknoise', i18nKey: 'soundPinkNoise', icon: 'pinknoise', generator: 'pinknoise' },
    { id: 'brownnoise', i18nKey: 'soundBrownNoise', icon: 'brownnoise', generator: 'brownnoise' },
    { id: 'binaural', i18nKey: 'soundBinaural', icon: 'binaural', generator: 'binaural' },
    { id: 'drone', i18nKey: 'soundDrone', icon: 'drone', generator: 'drone' },
    { id: 'space', i18nKey: 'soundSpace', icon: 'space', generator: 'space' },
    { id: 'chimes', i18nKey: 'soundChimes', icon: 'chimes', generator: 'chimes' },
    { id: 'hum', i18nKey: 'soundDeepHum', icon: 'hum', generator: 'hum' },
    { id: 'shimmer', i18nKey: 'soundShimmer', icon: 'shimmer', generator: 'shimmer' }
  ],
  tones: [
    { id: 'om', i18nKey: 'soundOm', icon: 'om', generator: 'om' },
    { id: 'hz174', i18nKey: 'soundHz174', icon: 'hz174', generator: 'hz174' },
    { id: 'hz285', i18nKey: 'soundHz285', icon: 'hz285', generator: 'hz285' },
    { id: 'hz396', i18nKey: 'soundHz396', icon: 'hz396', generator: 'hz396' },
    { id: 'hz432', i18nKey: 'soundHz432', icon: 'hz432', generator: 'hz432' },
    { id: 'hz528', i18nKey: 'soundHz528', icon: 'hz528', generator: 'hz528' },
    { id: 'hz639', i18nKey: 'soundHz639', icon: 'hz639', generator: 'hz639' },
    { id: 'hz741', i18nKey: 'soundHz741', icon: 'hz741', generator: 'hz741' },
    { id: 'hz852', i18nKey: 'soundHz852', icon: 'hz852', generator: 'hz852' }
  ]
};

let audioContext = null;
let currentNodes = [];
let currentSoundId = null;
let masterGain = null;

// Cross-tab audio sync
const audioChannel = new BroadcastChannel('zen-audio-sync');
const audioTabId = Math.random().toString(36).slice(2);

audioChannel.onmessage = (e) => {
  if (e.data?.type === 'audio-started' && e.data.tabId !== audioTabId) {
    stopRadio();
    stopSound();
    renderSoundsBar();
    renderRadioPanel();
    updateFavicon();
  }
};

// Update tab favicon based on audio state
function updateFavicon() {
  const favicon = document.getElementById('tabFavicon');
  const favicon32 = document.getElementById('tabFavicon32');
  if (!favicon) return;
  const isPlaying = (currentSoundId !== null) || (currentRadioStation !== null && !radioPausedState);
  favicon.href = isPlaying ? 'icons/icon16_active.png' : 'icons/icon16.png';
  if (favicon32) favicon32.href = isPlaying ? 'icons/icon32_active.png' : 'icons/icon32.png';
}

// Update MediaSession metadata so OS media keys route to this tab
let radioPausedState = false; // true when radio is paused (not fully stopped)

function updateMediaSession(title, artist) {
  if (!('mediaSession' in navigator)) return;
  if (title) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist || 'Zen Launcher',
    });
    navigator.mediaSession.playbackState = 'playing';
  } else {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
}

// Pause radio without destroying the stream
function pauseRadio() {
  if (currentRadioStation && radioAudio) {
    radioAudio.pause();
    radioPausedState = true;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    renderSoundsBar();
    renderRadioPanel();
    updateFavicon();
  }
}

// Resume paused radio
function resumeRadio() {
  if (currentRadioStation && radioAudio && radioPausedState) {
    radioAudio.play().catch(() => {});
    radioPausedState = false;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    renderSoundsBar();
    renderRadioPanel();
    updateFavicon();
  }
}

// Set up MediaSession handlers for hardware media keys (radio only)
function initMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    if (radioPausedState && currentRadioStation) {
      resumeRadio();
    } else if (!currentRadioStation) {
      toggleRadio();
    }
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    if (currentRadioStation && !radioPausedState) {
      pauseRadio();
    }
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    if (currentRadioStation) stopRadio();
  });
}

// Get or create audio context
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    const volumeSlider = document.getElementById('soundsBarVolume');
    masterGain.gain.value = volumeSlider ? volumeSlider.value / 100 : 0.5;
  }
  return audioContext;
}

// Sound generators using Web Audio API
const soundGenerators = {
  // White noise
  whitenoise: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    return [source];
  },
  
  // Pink noise (softer)
  pinknoise: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    return [source];
  },
  
  // Brown noise (deeper)
  brownnoise: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    return [source];
  },
  
  // Rain - gentle filtered noise with soft modulation
  rain: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Gentle lowpass to soften harsh frequencies
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    lp.Q.value = 0.3;
    // Remove sub-bass rumble
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    hp.Q.value = 0.5;
    // Subtle mid-cut for smoothness
    const notch = ctx.createBiquadFilter();
    notch.type = 'peaking';
    notch.frequency.value = 1500;
    notch.gain.value = -3;
    notch.Q.value = 0.8;
    // Slow volume modulation for natural ebb and flow
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.08;
    const volGain = ctx.createGain();
    volGain.gain.value = 0.55;
    lfo.connect(lfoGain);
    lfoGain.connect(volGain.gain);
    source.connect(lp);
    lp.connect(hp);
    hp.connect(notch);
    notch.connect(volGain);
    volGain.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },
  
  // Ocean - gentle rolling waves with brown noise
  ocean: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Soften highs
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.3;
    // Remove very low rumble
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    // Own volume node so LFO doesn't affect master gain
    const volGain = ctx.createGain();
    volGain.gain.value = 0.5;
    // Slow wave-like volume modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain);
    lfoGain.connect(volGain.gain);
    source.connect(lp);
    lp.connect(hp);
    hp.connect(volGain);
    volGain.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },
  
  // Wind - filtered noise with modulation
  wind: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.2;
    lfoGain.gain.value = 400;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    
    source.connect(filter);
    filter.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },
  
  // Fire - crackling noise
  fire: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (Math.random() > 0.98 ? 1 : 0.1);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    
    source.connect(filter);
    filter.connect(gain);
    source.start();
    return [source];
  },
  
  // Stream - gentle babbling brook
  stream: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Softer bandpass for water-like character
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.6;
    // Second softer layer for depth
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3500;
    lp.Q.value = 0.3;
    // Gentle frequency modulation for babbling effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.25;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    // Reduce overall volume
    const volGain = ctx.createGain();
    volGain.gain.value = 0.4;
    source.connect(bp);
    bp.connect(lp);
    lp.connect(volGain);
    volGain.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },
  
  // Thunder - rumbling
  thunder: (ctx, gain) => {
    const nodes = soundGenerators.brownnoise(ctx, gain);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    gain.disconnect();
    gain.connect(filter);
    filter.connect(masterGain);
    return nodes;
  },
  
  // Binaural beat (10Hz difference for alpha waves)
  binaural: (ctx, gain) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.frequency.value = 200;
    osc2.frequency.value = 210;
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    gainL.gain.value = 0.3;
    gainR.gain.value = 0.3;
    
    osc1.connect(gainL);
    osc2.connect(gainR);
    gainL.connect(gain);
    gainR.connect(gain);
    
    osc1.start();
    osc2.start();
    return [osc1, osc2];
  },
  
  // Drone - layered oscillators
  drone: (ctx, gain) => {
    const oscs = [];
    [55, 110, 165, 220].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.15;
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      oscs.push(osc);
    });
    return oscs;
  },
  
  // Space - ethereal pad
  space: (ctx, gain) => {
    const oscs = [];
    [82.41, 123.47, 164.81, 246.94].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.1 + i * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.1;
      osc.connect(oscGain);
      oscGain.connect(gain);
      
      osc.start();
      lfo.start();
      oscs.push(osc, lfo);
    });
    return oscs;
  },
  
  // Birds - random high chirps using oscillators
  birds: (ctx, gain) => {
    const nodes = [];
    // Background rustle (very quiet pink noise)
    const pinkNodes = soundGenerators.pinknoise(ctx, gain);
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0.05;
    gain.disconnect();
    gain.connect(rustleGain);
    rustleGain.connect(masterGain);
    nodes.push(...pinkNodes);
    // Chirp oscillators with random LFO
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 2000 + i * 800;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 3 + i * 2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 600;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.value = 0.3 + i * 0.15;
      const ampGain = ctx.createGain();
      ampGain.gain.value = 0.06;
      ampLfo.connect(ampGain);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0;
      ampGain.connect(oscGain.gain);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start();
      lfo.start();
      ampLfo.start();
      nodes.push(osc, lfo, ampLfo);
    }
    return nodes;
  },

  // Crickets - rapid oscillating tones
  crickets: (ctx, gain) => {
    const nodes = [];
    [4200, 4800, 5400].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.value = 15 + i * 5;
      const ampGain = ctx.createGain();
      ampGain.gain.value = 0.04;
      ampLfo.connect(ampGain);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0;
      ampGain.connect(oscGain.gain);
      // Slow on/off envelope
      const envLfo = ctx.createOscillator();
      envLfo.frequency.value = 0.2 + i * 0.1;
      const envGain = ctx.createGain();
      envGain.gain.value = 0.04;
      envLfo.connect(envGain);
      envGain.connect(oscGain.gain);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      ampLfo.start();
      envLfo.start();
      nodes.push(osc, ampLfo, envLfo);
    });
    return nodes;
  },

  // Waves - slow rhythmic brown noise
  waves: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    source.connect(filter);
    filter.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },

  // Chimes - random bell-like tones with slow LFO
  chimes: (ctx, gain) => {
    const nodes = [];
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.value = 0.15 + i * 0.08;
      const ampGain = ctx.createGain();
      ampGain.gain.value = 0.06;
      ampLfo.connect(ampGain);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0;
      ampGain.connect(oscGain.gain);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      ampLfo.start();
      nodes.push(osc, ampLfo);
    });
    return nodes;
  },

  // Deep Hum - sub-bass resonance
  hum: (ctx, gain) => {
    const nodes = [];
    [40, 80, 120].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.2 - i * 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    });
    return nodes;
  },

  // Shimmer - high sparkling harmonics
  shimmer: (ctx, gain) => {
    const nodes = [];
    [880, 1320, 1760, 2640, 3520].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.04;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.04 / (i + 1);
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    });
    return nodes;
  },

  // Singing Bowl - detuned harmonics creating wavering resonance
  singingbowl: (ctx, gain) => {
    const nodes = [];
    const fundamentals = [261.6, 392.0, 523.3, 659.3, 784.0];
    fundamentals.forEach((freq, i) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq + 1.5 + i * 0.3; // slight detune for beating
      const oscGain1 = ctx.createGain();
      const oscGain2 = ctx.createGain();
      const vol = 0.06 / (i + 1);
      oscGain1.gain.value = vol;
      oscGain2.gain.value = vol;
      // Slow amplitude LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = vol * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(oscGain1.gain);
      osc1.connect(oscGain1);
      osc2.connect(oscGain2);
      oscGain1.connect(gain);
      oscGain2.connect(gain);
      osc1.start();
      osc2.start();
      lfo.start();
      nodes.push(osc1, osc2, lfo);
    });
    return nodes;
  },

  // Waterfall - heavy cascading water
  waterfall: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Heavy lowpass for rumble
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.5;
    // Mid boost for body
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 400;
    peak.gain.value = 6;
    peak.Q.value = 1;
    // Highpass to remove very low rumble
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;
    const volGain = ctx.createGain();
    volGain.gain.value = 1.2;
    source.connect(lp);
    lp.connect(peak);
    peak.connect(hp);
    hp.connect(volGain);
    volGain.connect(gain);
    source.start();
    return [source];
  },

  // Heartbeat - slow rhythmic low-frequency pulses
  heartbeat: (ctx, gain) => {
    const nodes = [];
    const bufferSize = 2 * ctx.sampleRate;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buffer.getChannelData(0);
    const bpm = 60;
    const beatInterval = sampleRate * 60 / bpm;
    const dubGap = sampleRate * 0.18; // gap between lub-dub
    for (let i = 0; i < bufferSize; i++) {
      const posInBeat = i % beatInterval;
      let val = 0;
      // "Lub" pulse
      if (posInBeat < sampleRate * 0.08) {
        const t = posInBeat / (sampleRate * 0.08);
        val = Math.sin(t * Math.PI) * Math.sin(2 * Math.PI * 45 * posInBeat / sampleRate);
      }
      // "Dub" pulse (slightly softer)
      const dubPos = posInBeat - dubGap;
      if (dubPos > 0 && dubPos < sampleRate * 0.06) {
        const t = dubPos / (sampleRate * 0.06);
        val += Math.sin(t * Math.PI) * Math.sin(2 * Math.PI * 55 * dubPos / sampleRate) * 0.7;
      }
      output[i] = val;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;
    const volGain = ctx.createGain();
    volGain.gain.value = 0.8;
    source.connect(lp);
    lp.connect(volGain);
    volGain.connect(gain);
    source.start();
    nodes.push(source);
    return nodes;
  },

  // Breath - rhythmic inhale/exhale noise
  breath: (ctx, gain) => {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.8;
    // LFO for volume cycling (inhale 3s, exhale 4s ~ 0.14Hz)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    lfo.type = 'sine';
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    const baseGain = ctx.createGain();
    baseGain.gain.value = 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(baseGain.gain);
    source.connect(bp);
    bp.connect(baseGain);
    baseGain.connect(gain);
    source.start();
    lfo.start();
    return [source, lfo];
  },

  // Cave Drip - ambient cave with periodic drips
  cavedrip: (ctx, gain) => {
    const nodes = [];
    // Background: low brown noise for cave ambience
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      output[i] = last * 3.5;
    }
    const bgSource = ctx.createBufferSource();
    bgSource.buffer = buffer;
    bgSource.loop = true;
    const bgLp = ctx.createBiquadFilter();
    bgLp.type = 'lowpass';
    bgLp.frequency.value = 300;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.25;
    bgSource.connect(bgLp);
    bgLp.connect(bgGain);
    bgGain.connect(gain);
    bgSource.start();
    nodes.push(bgSource);
    // Drip sounds at random intervals
    let dripActive = true;
    function scheduleDrip() {
      if (!dripActive) return;
      const delay = 1 + Math.random() * 3; // 1-4 seconds
      setTimeout(() => {
        if (!dripActive) return;
        try {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2500 + Math.random() * 1500, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
          const dripGain = ctx.createGain();
          dripGain.gain.setValueAtTime(0.12, ctx.currentTime);
          dripGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.connect(dripGain);
          dripGain.connect(gain);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch(e) {}
        scheduleDrip();
      }, delay * 1000);
    }
    scheduleDrip();
    // Override stop by flagging
    const origStop = bgSource.stop.bind(bgSource);
    bgSource.stop = function() { dripActive = false; origStop(); };
    return nodes;
  },

  // Bamboo - periodic hollow tock sounds (shishi-odoshi)
  bamboo: (ctx, gain) => {
    const nodes = [];
    // Soft brown noise bed
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      output[i] = last * 3.5;
    }
    const bgSource = ctx.createBufferSource();
    bgSource.buffer = buffer;
    bgSource.loop = true;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.08;
    bgSource.connect(bgGain);
    bgGain.connect(gain);
    bgSource.start();
    nodes.push(bgSource);
    // Periodic bamboo tock sounds
    let tockActive = true;
    function scheduleTock() {
      if (!tockActive) return;
      const delay = 2 + Math.random() * 4; // 2-6 seconds
      setTimeout(() => {
        if (!tockActive) return;
        try {
          // Hollow tock: bandpass noise burst
          const tockBuf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
          const tockData = tockBuf.getChannelData(0);
          for (let i = 0; i < tockData.length; i++) {
            const env = Math.exp(-i / (ctx.sampleRate * 0.015));
            tockData[i] = (Math.random() * 2 - 1) * env;
          }
          const tockSrc = ctx.createBufferSource();
          tockSrc.buffer = tockBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 800 + Math.random() * 400;
          bp.Q.value = 5;
          const tockGain = ctx.createGain();
          tockGain.gain.value = 0.3;
          tockSrc.connect(bp);
          bp.connect(tockGain);
          tockGain.connect(gain);
          tockSrc.start();
        } catch(e) {}
        scheduleTock();
      }, delay * 1000);
    }
    scheduleTock();
    const origStop = bgSource.stop.bind(bgSource);
    bgSource.stop = function() { tockActive = false; origStop(); };
    return nodes;
  },

  // Gong - rich harmonics with periodic strikes
  gong: (ctx, gain) => {
    const nodes = [];
    let gongActive = true;
    function strikeGong() {
      if (!gongActive) return;
      try {
        const harmonics = [130.8, 261.6, 355, 523.3, 698.5];
        harmonics.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq + (Math.random() - 0.5) * 4;
          const oscGain = ctx.createGain();
          const vol = 0.12 / (i + 1);
          oscGain.gain.setValueAtTime(0, ctx.currentTime);
          oscGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.3);
          oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 6);
          osc.connect(oscGain);
          oscGain.connect(gain);
          osc.start();
          osc.stop(ctx.currentTime + 6.5);
        });
      } catch(e) {}
    }
    strikeGong(); // First strike immediately
    const interval = setInterval(() => {
      if (!gongActive) return;
      strikeGong();
    }, 8000 + Math.random() * 4000);
    // Dummy node for cleanup
    const dummy = ctx.createGain();
    dummy.gain.value = 0;
    dummy.connect(gain);
    nodes.push(dummy);
    const origDisconnect = dummy.disconnect.bind(dummy);
    dummy.disconnect = function() { gongActive = false; clearInterval(interval); origDisconnect(); };
    return nodes;
  },

  // Lullaby - slow pentatonic arpeggio
  lullaby: (ctx, gain) => {
    const nodes = [];
    let lullabyActive = true;
    const notes = [261.6, 293.7, 329.6, 392.0, 440.0]; // C4 D4 E4 G4 A4
    let noteIndex = 0;
    function playNote() {
      if (!lullabyActive) return;
      try {
        const freq = notes[noteIndex % notes.length];
        noteIndex++;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, ctx.currentTime);
        oscGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.3);
        oscGain.gain.setValueAtTime(0.08, ctx.currentTime + 1.0);
        oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        osc.connect(oscGain);
        oscGain.connect(gain);
        osc.start();
        osc.stop(ctx.currentTime + 2);
      } catch(e) {}
    }
    playNote();
    const interval = setInterval(() => {
      if (!lullabyActive) return;
      playNote();
    }, 1800);
    const dummy = ctx.createGain();
    dummy.gain.value = 0;
    dummy.connect(gain);
    nodes.push(dummy);
    const origDisconnect = dummy.disconnect.bind(dummy);
    dummy.disconnect = function() { lullabyActive = false; clearInterval(interval); origDisconnect(); };
    return nodes;
  },

  // Zen Garden - gentle water trickle + random bamboo knocks
  zengarden: (ctx, gain) => {
    const nodes = [];
    // Water trickle: bandpass-filtered noise
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    bp.Q.value = 1.5;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.06;
    // Slow volume modulation for trickle
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(waterGain.gain);
    source.connect(bp);
    bp.connect(hp);
    hp.connect(waterGain);
    waterGain.connect(gain);
    source.start();
    lfo.start();
    nodes.push(source, lfo);
    // Random bamboo knocks
    let knockActive = true;
    function scheduleKnock() {
      if (!knockActive) return;
      const delay = 3 + Math.random() * 5;
      setTimeout(() => {
        if (!knockActive) return;
        try {
          const knockBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
          const kd = knockBuf.getChannelData(0);
          for (let i = 0; i < kd.length; i++) {
            const env = Math.exp(-i / (ctx.sampleRate * 0.012));
            kd[i] = (Math.random() * 2 - 1) * env;
          }
          const knockSrc = ctx.createBufferSource();
          knockSrc.buffer = knockBuf;
          const kbp = ctx.createBiquadFilter();
          kbp.type = 'bandpass';
          kbp.frequency.value = 600 + Math.random() * 300;
          kbp.Q.value = 6;
          const kGain = ctx.createGain();
          kGain.gain.value = 0.2;
          knockSrc.connect(kbp);
          kbp.connect(kGain);
          kGain.connect(gain);
          knockSrc.start();
        } catch(e) {}
        scheduleKnock();
      }, delay * 1000);
    }
    scheduleKnock();
    const origStop = source.stop.bind(source);
    source.stop = function() { knockActive = false; origStop(); };
    return nodes;
  },

  // Frequency tones
  om: (ctx, gain) => createTone(ctx, gain, 136.1),
  hz174: (ctx, gain) => createTone(ctx, gain, 174),
  hz285: (ctx, gain) => createTone(ctx, gain, 285),
  hz396: (ctx, gain) => createTone(ctx, gain, 396),
  hz432: (ctx, gain) => createTone(ctx, gain, 432),
  hz528: (ctx, gain) => createTone(ctx, gain, 528),
  hz639: (ctx, gain) => createTone(ctx, gain, 639),
  hz741: (ctx, gain) => createTone(ctx, gain, 741),
  hz852: (ctx, gain) => createTone(ctx, gain, 852)
};

// Helper for pure tones
function createTone(ctx, gain, frequency) {
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  osc.type = 'sine';
  const oscGain = ctx.createGain();
  oscGain.gain.value = 0.3;
  osc.connect(oscGain);
  oscGain.connect(gain);
  osc.start();
  return [osc];
}

// Track overflow panel state
let soundsOverflowOpen = false;

function renderSoundsBar() {
  const scroll = document.getElementById('soundsBarScroll');
  if (!scroll) return;
  
  // Combine all sounds
  const allSounds = [
    ...SOUNDS_DATA.nature,
    ...SOUNDS_DATA.zen,
    ...SOUNDS_DATA.ambient,
    ...SOUNDS_DATA.tones
  ];
  
  const radioPlaying = !!currentRadioStation;
  const radioStationName = currentRadioStation ? currentRadioStation.name : '';
  const radioPaused = radioPausedState && radioPlaying;
  
  // Build bar HTML: Radio | sep | sounds (as many as fit) | more | sep | Search
  scroll.innerHTML = `
    <div class="sound-bar-item radio-btn ${radioPlaying ? 'playing' : ''} ${radioPaused ? 'paused' : ''} ${radioBuffering && radioPlaying && !radioPaused ? 'buffering' : ''}" id="radioBtnToggle" title="${radioPlaying ? escapeHtml(radioStationName) : t('radioLabel')}">
      <div class="sound-bar-item-icon"><svg viewBox="0 0 24 24" fill="none">${SOUND_ICONS.radio}</svg></div>
      ${radioPaused ? '<div class="radio-paused-overlay"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></div>' : ''}
    </div>
    <div class="sound-bar-separator"></div>
    <div class="sounds-bar-middle" id="soundsBarMiddle">
      ${allSounds.map(sound => {
        const name = t(sound.i18nKey);
        return `
        <div class="sound-bar-item sound-bar-gen ${currentSoundId === sound.id ? 'playing' : ''}" 
             data-sound-id="${sound.id}" 
             data-sound-generator="${sound.generator}"
             data-sound-name="${escapeHtml(name)}"
             title="${escapeHtml(name)}">
          <div class="sound-bar-item-icon"><svg viewBox="0 0 24 24" fill="none">${SOUND_ICONS[sound.icon] || ''}</svg></div>
        </div>`;
      }).join('')}
    </div>
    <div class="sound-bar-item sounds-more-btn ${soundsOverflowOpen ? 'active' : ''} ${currentSoundId ? 'sound-playing' : ''}" id="soundsMoreBtn" title="${t('moreSounds')}">
      ${currentSoundId
        ? '<div class="sound-bar-item-icon sounds-eq-indicator"><span></span><span></span><span></span></div>'
        : `<div class="sound-bar-item-icon"><svg viewBox="0 0 24 24" fill="none">${SOUND_ICONS.more}</svg></div>`}
    </div>
    <div class="sound-bar-separator"></div>
    <div class="sound-bar-item radio-search-btn" id="radioSearchToggle" title="${t('browseStations')}">
      <div class="sound-bar-item-icon"><svg viewBox="0 0 24 24" fill="none">${SOUND_ICONS.radioSearch}</svg></div>
    </div>
  `;
  
  // Build overflow panel (always shows ALL sounds with names)
  renderSoundsOverflowPanel(allSounds);
  
  // Show/hide controls bar
  updateControlsVisibility();
  
  // Click handlers for inline sound items
  scroll.querySelectorAll('.sound-bar-gen').forEach(item => {
    item.addEventListener('click', () => {
      toggleSound(item.dataset.soundId, item.dataset.soundGenerator, item.dataset.soundName);
    });
  });
  
  // Radio button
  const radioBtn = document.getElementById('radioBtnToggle');
  if (radioBtn) {
    radioBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRadio(); });
  }
  
  // Search button
  const radioSearchBtn = document.getElementById('radioSearchToggle');
  if (radioSearchBtn) {
    radioSearchBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRadioPanel(); });
  }
  
  // More button
  const moreBtn = document.getElementById('soundsMoreBtn');
  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSoundsOverflow(); });
  }
}

// Overflow panel — always shows ALL sounds with icon + name
function renderSoundsOverflowPanel(allSounds) {
  let panel = document.getElementById('soundsOverflowPanel');
  if (!panel) {
    const bar = document.getElementById('soundsBar');
    if (!bar) return;
    panel = document.createElement('div');
    panel.className = 'sounds-overflow-panel';
    panel.id = 'soundsOverflowPanel';
    bar.appendChild(panel);
  }
  
  panel.innerHTML = `
    <div class="sounds-overflow-grid">
      ${allSounds.map(sound => {
        const name = t(sound.i18nKey);
        return `
        <div class="sound-bar-item ${currentSoundId === sound.id ? 'playing' : ''}" 
             data-sound-id="${sound.id}" 
             data-sound-generator="${sound.generator}"
             data-sound-name="${escapeHtml(name)}"
             title="${escapeHtml(name)}">
          <div class="sound-bar-item-icon"><svg viewBox="0 0 24 24" fill="none">${SOUND_ICONS[sound.icon] || ''}</svg></div>
          <span class="sound-overflow-label">${escapeHtml(name)}</span>
        </div>`;
      }).join('')}
    </div>
  `;
  
  panel.classList.toggle('open', soundsOverflowOpen);
  
  // Click handlers
  panel.querySelectorAll('.sound-bar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSound(item.dataset.soundId, item.dataset.soundGenerator, item.dataset.soundName);
    });
  });
}

function toggleSoundsOverflow() {
  soundsOverflowOpen = !soundsOverflowOpen;
  const panel = document.getElementById('soundsOverflowPanel');
  const moreBtn = document.getElementById('soundsMoreBtn');
  const wrap = document.getElementById('soundsBarWrap');
  if (panel) {
    panel.classList.toggle('open', soundsOverflowOpen);
  }
  if (moreBtn) {
    moreBtn.classList.toggle('active', soundsOverflowOpen);
  }
  if (wrap) {
    wrap.classList.toggle('sounds-overflow-open', soundsOverflowOpen);
  }
  // Close radio panel if open
  if (soundsOverflowOpen && radioPanelOpen) {
    closeRadioPanel();
  }
}

function closeSoundsOverflow() {
  soundsOverflowOpen = false;
  const panel = document.getElementById('soundsOverflowPanel');
  const moreBtn = document.getElementById('soundsMoreBtn');
  const wrap = document.getElementById('soundsBarWrap');
  if (panel) panel.classList.remove('open');
  if (moreBtn) moreBtn.classList.remove('active');
  if (wrap) wrap.classList.remove('sounds-overflow-open');
}

// Toggle sound play/pause
function toggleSound(soundId, generator, soundName) {
  // If clicking the same sound, stop it
  if (currentSoundId === soundId) {
    stopSound();
    return;
  }
  
  // Stop radio if playing (mutual exclusion)
  if (currentRadioStation) {
    stopRadio();
  }
  
  // Stop current sound
  stopSound();
  
  // Start new sound
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  const volumeSlider = document.getElementById('soundsBarVolume');
  const soundGain = ctx.createGain();
  soundGain.gain.value = volumeSlider ? volumeSlider.value / 100 : 0.5;
  soundGain.connect(masterGain);
  
  if (soundGenerators[generator]) {
    currentNodes = soundGenerators[generator](ctx, soundGain);
    currentNodes.push(soundGain);
    currentSoundId = soundId;
    
    // Notify other tabs to stop their audio
    audioChannel.postMessage({ type: 'audio-started', tabId: audioTabId });
    
    // Update bar UI
    renderSoundsBar();
    updateFavicon();
  }
}

// Stop sound
function stopSound() {
  currentNodes.forEach(node => {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (e) {}
  });
  currentNodes = [];
  currentSoundId = null;
  
  // Update bar UI
  renderSoundsBar();
  updateFavicon();
}

// Update volume percentage label and icon
function updateVolumeLabel(value) {
  const label = document.getElementById('soundsVolumeLabel');
  if (label) label.textContent = Math.round(value) + '%';
  const icon = document.getElementById('soundsVolumeIcon');
  if (icon) {
    const v = Math.round(value);
    if (v === 0) {
      icon.innerHTML = '<path d="M16.5 12A4.5 4.5 0 0012 8.14v.91l4.02 4.02c.31-.7.48-1.36.48-1.07zM19 12a6.9 6.9 0 01-.55 2.73l1.45 1.45A8.9 8.9 0 0020.5 12 8.51 8.51 0 0012 3.23v2.06a6.51 6.51 0 016.7 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.97 6.97 0 0112 19.28v2.06a8.83 8.83 0 005.48-2.31L19.73 21 21 19.73l-9-9L4.27 3zM12 4l-2.11 2.11L12 8.24V4z" fill="currentColor"/>';
    } else if (v <= 33) {
      icon.innerHTML = '<path d="M7 9v6h4l5 5V4L7 9z" fill="currentColor"/>';
    } else if (v <= 66) {
      icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0012 8.14v7.72A4.49 4.49 0 0016.5 12z" fill="currentColor"/>';
    } else {
      icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0012 8.14v7.72A4.49 4.49 0 0016.5 12zM12 3.23v2.06a6.51 6.51 0 010 13.42v2.06A8.51 8.51 0 0020.5 12 8.51 8.51 0 0012 3.23z" fill="currentColor"/>';
    }
  }
}

// Initialize sounds
function initSounds() {
  const volumeSlider = document.getElementById('soundsBarVolume');
  
  // Restore persisted volume
  chrome.storage.local.get(['soundVolume'], (result) => {
    const saved = result.soundVolume;
    if (saved !== undefined && volumeSlider) {
      volumeSlider.value = saved;
      updateVolumeLabel(saved);
      const vol = saved / 100;
      if (masterGain) masterGain.gain.value = vol;
      if (radioAudio) radioAudio.volume = vol;
    }
  });
  
  // Render all sounds in the bar
  renderSoundsBar();
  
  // Volume control (handles both generated sounds AND radio)
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      const vol = volumeSlider.value / 100;
      if (masterGain) {
        masterGain.gain.value = vol;
      }
      if (radioAudio) {
        radioAudio.volume = vol;
      }
      updateVolumeLabel(volumeSlider.value);
      chrome.storage.local.set({ soundVolume: Number(volumeSlider.value) });
    });
  }
  
  // Load recent radio stations
  loadRecentRadio();
  
  // Render radio panel
  renderRadioPanel();
  
  // --- Controls bar hover show/hide ---
  const wrap = document.getElementById('soundsBarWrap');
  const controls = document.getElementById('soundsControls');
  let controlsHideTimeout = null;
  
  function showControls() {
    if (!isAnySoundPlaying()) return;
    clearTimeout(controlsHideTimeout);
    if (controls) controls.classList.add('visible');
  }
  
  function scheduleHideControls() {
    clearTimeout(controlsHideTimeout);
    controlsHideTimeout = setTimeout(() => {
      if (controls) controls.classList.remove('visible');
    }, 3000);
  }
  
  if (wrap) {
    wrap.addEventListener('mouseenter', () => {
      showControls();
    });
    wrap.addEventListener('mouseleave', () => {
      scheduleHideControls();
    });
  }
  
  // Stop button
  const stopBtn = document.getElementById('soundsStopBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentRadioStation) stopRadio();
      if (currentSoundId) stopSound();
    });
  }
  
  // Close radio panel / overflow panel on outside click
  document.addEventListener('click', (e) => {
    const wrapEl = document.getElementById('soundsBarWrap');
    const isOutside = wrapEl && !wrapEl.contains(e.target);
    if (isOutside) {
      if (radioPanelOpen) closeRadioPanel();
      if (soundsOverflowOpen) closeSoundsOverflow();
    }
  });
  
  // Close panels on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (radioPanelOpen) closeRadioPanel();
      if (soundsOverflowOpen) closeSoundsOverflow();
    }
  });
  
  
  // Alt+Shift+P: Toggle radio play/stop
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyP')) {
      e.preventDefault();
      toggleRadio();
    }
  });

  // Media keys (play/pause on Mac keyboard, media keyboards, etc.)
  initMediaSession();
}

// Check if any sound or radio is currently playing
function isAnySoundPlaying() {
  return !!(currentSoundId || currentRadioStation);
}

// Show/hide controls bar based on playing state
function updateControlsVisibility() {
  const controls = document.getElementById('soundsControls');
  if (!controls) return;
  if (isAnySoundPlaying()) {
    controls.classList.add('visible');
    // Auto-hide after 3s if mouse not hovering
    const wrap = document.getElementById('soundsBarWrap');
    if (wrap && !wrap.matches(':hover')) {
      clearTimeout(window._controlsHideTimeout);
      window._controlsHideTimeout = setTimeout(() => {
        if (!wrap.matches(':hover')) {
          controls.classList.remove('visible');
        }
      }, 3000);
    }
  } else {
    controls.classList.remove('visible');
  }
}

// ============ Radio Functions ============

// Play a radio station
function playRadio(station) {
  // Stop generated sounds first (mutual exclusion)
  if (currentSoundId) {
    stopSound();
  }
  
  // If clicking the same station, stop it
  if (currentRadioStation && currentRadioStation.id === station.id) {
    stopRadio();
    return;
  }
  
  // Stop current radio if different station
  if (radioAudio) {
    radioAudio.pause();
    radioAudio.src = '';
  }
  
  // Create or reuse audio element
  if (!radioAudio) {
    radioAudio = new Audio();
    radioAudio.crossOrigin = 'anonymous';
    // Audio state events for buffering indicator
    radioAudio.addEventListener('playing', () => {
      radioBuffering = false;
      updateRadioBufferingUI();
    });
    radioAudio.addEventListener('waiting', () => {
      radioBuffering = true;
      updateRadioBufferingUI();
    });
    radioAudio.addEventListener('stalled', () => {
      radioBuffering = true;
      updateRadioBufferingUI();
    });
    radioAudio.addEventListener('error', () => {
      radioBuffering = false;
      updateRadioBufferingUI();
    });
  }
  
  // Set buffering state immediately
  radioBuffering = true;
  
  const volumeSlider = document.getElementById('soundsBarVolume');
  radioAudio.volume = volumeSlider ? volumeSlider.value / 100 : 0.5;
  radioAudio.src = station.streamUrl;
  radioAudio.play().catch(err => {
    console.warn('[Radio] Play failed:', err);
    radioBuffering = false;
    updateRadioBufferingUI();
  });
  
  currentRadioStation = station;
  radioPausedState = false;
  updateMediaSession(station.name, station.description || 'Radio');
  
  // Notify other tabs to stop their audio
  audioChannel.postMessage({ type: 'audio-started', tabId: audioTabId });
  
  // Add to recent
  addToRecentRadio(station);
  
  // Save last played station
  chrome.storage.local.set({ radioLastStation: station });
  
  // Update UI
  renderSoundsBar();
  renderRadioPanel();
  updateFavicon();
  
  updateRadioBufferingUI();
}

// Update radio button buffering visual state
function updateRadioBufferingUI() {
  const btn = document.getElementById('radioBtnToggle');
  if (btn) {
    btn.classList.toggle('buffering', radioBuffering && !!currentRadioStation);
  }
}

// Stop radio
function stopRadio() {
  if (radioAudio) {
    radioAudio.pause();
    radioAudio.src = '';
  }
  currentRadioStation = null;
  radioBuffering = false;
  radioPausedState = false;
  updateMediaSession(null);
  
  // Update UI
  renderSoundsBar();
  renderRadioPanel();
  updateFavicon();
}

// Toggle radio on/off (plays last station or first preset)
function toggleRadio() {
  if (currentRadioStation && radioPausedState) {
    // Resume paused radio
    resumeRadio();
    return;
  }
  if (currentRadioStation) {
    // Pause instead of stop
    pauseRadio();
    return;
  }
  
  // Try last played station from storage
  chrome.storage.local.get('radioLastStation', (data) => {
    const station = data.radioLastStation || RADIO_PRESETS[0];
    playRadio(station);
  });
}

// Search radio stations via Radio Browser API
function searchRadioStations(query) {
  clearTimeout(radioSearchTimeout);
  
  if (!query || query.trim().length < 2) {
    radioSearching = false;
    radioSearchDone = false;
    radioSearchResults = [];
    renderRadioPanel();
    return;
  }
  
  // Show loading state immediately
  radioSearching = true;
  radioSearchDone = false;
  radioSearchResults = [];
  renderRadioPanel();
  
  radioSearchTimeout = setTimeout(async () => {
    try {
      const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query.trim())}&limit=10&order=votes&reverse=true&hidebroken=true`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Search failed');
      const stations = await resp.json();
      
      radioSearchResults = stations
        .filter(s => s.url_resolved || s.url)
        .map(s => ({
          id: 'rb-' + s.stationuuid,
          name: s.name,
          description: [s.country, s.tags].filter(Boolean).join(' · ').substring(0, 60),
          streamUrl: s.url_resolved || s.url,
          source: 'Radio Browser',
          votes: s.votes || 0,
          clickcount: s.clickcount || 0,
          clicktrend: s.clicktrend || 0,
          bitrate: s.bitrate || 0,
          codec: s.codec || ''
        }));
      
      radioSearching = false;
      radioSearchDone = true;
      renderRadioPanel();
    } catch (err) {
      console.warn('[Radio] Search error:', err);
      radioSearching = false;
      radioSearchDone = true;
      radioSearchResults = [];
      renderRadioPanel();
    }
  }, 400);
}

// Load recent radio stations from storage
function loadRecentRadio() {
  chrome.storage.local.get('radioRecent', (data) => {
    radioRecentStations = data.radioRecent || [];
    renderRadioPanel();
  });
}

// Add a station to recent history (max 50, no duplicates)
function addToRecentRadio(station) {
  // Remove if already exists
  radioRecentStations = radioRecentStations.filter(s => s.id !== station.id);
  // Add to front
  radioRecentStations.unshift({
    id: station.id,
    name: station.name,
    description: station.description,
    streamUrl: station.streamUrl,
    source: station.source
  });
  // Limit to max
  if (radioRecentStations.length > RADIO_RECENT_MAX) {
    radioRecentStations = radioRecentStations.slice(0, RADIO_RECENT_MAX);
  }
  // Save
  chrome.storage.local.set({ radioRecent: radioRecentStations });
}

// Helper: render a station row
function renderStationRow(s, playingId, showStats = false) {
  // Popularity bar: normalize votes to 0-100% (log scale, cap at 10000)
  let statsHtml = '';
  let bitrateHtml = '';
  if (showStats && s.votes !== undefined) {
    const popPercent = Math.min(100, Math.round(Math.log10(Math.max(1, s.votes)) / 4 * 100));
    const trendIcon = s.clicktrend > 0 ? '▲' : s.clicktrend < 0 ? '▼' : '';
    const trendClass = s.clicktrend > 0 ? 'trend-up' : s.clicktrend < 0 ? 'trend-down' : '';
    const bitrateLabel = s.bitrate ? `${s.bitrate} kbps` : '';
    const codecLabel = s.codec || '';
    const bitrateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12h4l3-8 4 16 3-8h6"/></svg>';
    
    statsHtml = `
      <div class="radio-station-stats">
        <div class="radio-stat-pop" title="${s.votes} votes">
          <div class="radio-pop-bar"><div class="radio-pop-fill" style="width:${popPercent}%"></div></div>
        </div>
        <div class="radio-stat-meta">
          ${s.clickcount ? `<span class="radio-stat-clicks" title="${formatStatNumber(s.clickcount)} plays">♫ ${formatStatNumber(s.clickcount)}</span>` : ''}
          ${trendIcon ? `<span class="radio-stat-trend ${trendClass}">${trendIcon}${Math.abs(s.clicktrend)}</span>` : ''}
        </div>
      </div>
    `;
    if (bitrateLabel) {
      bitrateHtml = `<span class="radio-stat-quality" title="${codecLabel} ${bitrateLabel}">${bitrateIcon}${bitrateLabel}</span>`;
    }
  }
  
  return `
    <div class="radio-station-item ${playingId === s.id ? 'playing' : ''}" data-radio-id="${s.id}">
      <div class="radio-station-info">
        <span class="radio-station-name">${escapeHtml(s.name)}</span>
        <span class="radio-station-desc">${escapeHtml(s.description)}${bitrateHtml ? ` ${bitrateHtml}` : ''}</span>
      </div>
      ${statsHtml}
      ${playingId === s.id ? '<div class="radio-playing-indicator"><span></span><span></span><span></span></div>' : ''}
    </div>
  `;
}

function formatStatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

// Render the radio dropdown panel
function renderRadioPanel() {
  const presetsEl = document.getElementById('radioPresets');
  const recentEl = document.getElementById('radioRecent');
  const resultsEl = document.getElementById('radioResults');
  if (!presetsEl) return;
  
  const playingId = currentRadioStation ? currentRadioStation.id : null;
  const isSearchMode = radioSearching || radioSearchResults.length > 0 || radioSearchDone;
  
  // --- SEARCH MODE: show loading or results only ---
  if (isSearchMode) {
    // Hide recent & presets during search
    recentEl.innerHTML = '';
    recentEl.style.display = 'none';
    presetsEl.innerHTML = '';
    presetsEl.style.display = 'none';
    
    if (radioSearching) {
      // Loading state
      resultsEl.innerHTML = `
        <div class="radio-search-loading">
          <div class="radio-loading-bars"><span></span><span></span><span></span><span></span></div>
          <span>${t('radioSearching')}</span>
        </div>
      `;
      resultsEl.style.display = '';
    } else if (radioSearchResults.length === 0) {
      // No results
      resultsEl.innerHTML = `
        <div class="radio-search-loading">
          <span>${t('radioNoResults')}</span>
        </div>
      `;
      resultsEl.style.display = '';
    } else {
      // Results
      resultsEl.innerHTML = `
        <div class="radio-section-label">${t('radioResults')}</div>
        ${radioSearchResults.map(s => renderStationRow(s, playingId, true)).join('')}
      `;
      resultsEl.style.display = '';
    }
  } else {
    // --- IDLE MODE: show Recent (collapsed) then Presets ---
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';
    
    // Recent section
    if (radioRecentStations.length > 0) {
      const showAll = radioRecentExpanded;
      const visible = showAll ? radioRecentStations : radioRecentStations.slice(0, RADIO_RECENT_COLLAPSED);
      const hasMore = radioRecentStations.length > RADIO_RECENT_COLLAPSED;
      
      recentEl.innerHTML = `
        <div class="radio-section-header">
          <span class="radio-section-label">${t('radioRecent')}</span>
          <span class="radio-clear-recent" id="radioClearRecent" title="${t('radioClear')}">${t('radioClear')}</span>
        </div>
        ${visible.map(s => renderStationRow(s, playingId)).join('')}
        ${hasMore ? `<div class="radio-show-more" id="radioShowMoreRecent">${showAll ? t('radioShowLess') : `${t('radioShowMore')} (${radioRecentStations.length})`}</div>` : ''}
      `;
      recentEl.style.display = '';
    } else {
      recentEl.innerHTML = '';
      recentEl.style.display = 'none';
    }
    
    // Presets section
    presetsEl.innerHTML = `
      <div class="radio-section-label">${t('radioStations')}</div>
      ${RADIO_PRESETS.map(s => renderStationRow(s, playingId)).join('')}
    `;
    presetsEl.style.display = '';
  }
  
  // Attach click handlers for station items
  document.querySelectorAll('#radioPanel .radio-station-item').forEach(item => {
    item.addEventListener('click', () => {
      const stationId = item.dataset.radioId;
      const station = RADIO_PRESETS.find(s => s.id === stationId)
        || radioRecentStations.find(s => s.id === stationId)
        || radioSearchResults.find(s => s.id === stationId);
      if (station) {
        playRadio(station);
      }
    });
  });
  
  // Show more / show less handler
  const showMoreBtn = document.getElementById('radioShowMoreRecent');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      radioRecentExpanded = !radioRecentExpanded;
      renderRadioPanel();
    });
  }
  
  // Clear recent handler
  const clearRecentBtn = document.getElementById('radioClearRecent');
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      radioRecentStations = [];
      radioRecentExpanded = false;
      chrome.storage.local.remove('radioRecent');
      renderRadioPanel();
    });
  }
}

// Toggle radio panel open/closed
function toggleRadioPanel() {
  if (radioPanelOpen) {
    closeRadioPanel();
  } else {
    openRadioPanel();
  }
}

// Open radio panel
function openRadioPanel() {
  const panel = document.getElementById('radioPanel');
  const bar = document.getElementById('soundsBar');
  const wrap = document.getElementById('soundsBarWrap');
  const searchInput = document.getElementById('radioSearchInput');
  if (!panel || !bar) return;
  
  // Close overflow panel if open
  if (soundsOverflowOpen) closeSoundsOverflow();
  
  radioPanelOpen = true;
  radioHighlightIndex = -1;
  panel.classList.add('open');
  if (wrap) wrap.classList.add('radio-panel-open');
  
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
    searchInput.addEventListener('input', handleRadioSearch);
    searchInput.addEventListener('keydown', handleRadioKeydown);
  }
  
  radioSearchResults = [];
  radioSearching = false;
  radioSearchDone = false;
  radioRecentExpanded = false;
  renderRadioPanel();
}

// Close radio panel
function closeRadioPanel() {
  const panel = document.getElementById('radioPanel');
  const bar = document.getElementById('soundsBar');
  const wrap = document.getElementById('soundsBarWrap');
  const searchInput = document.getElementById('radioSearchInput');
  if (!panel || !bar) return;
  
  radioPanelOpen = false;
  radioHighlightIndex = -1;
  panel.classList.remove('open');
  if (wrap) wrap.classList.remove('radio-panel-open');
  
  if (searchInput) {
    searchInput.value = '';
    searchInput.removeEventListener('input', handleRadioSearch);
    searchInput.removeEventListener('keydown', handleRadioKeydown);
  }
  
  radioSearchResults = [];
  radioSearching = false;
  radioSearchDone = false;
  radioRecentExpanded = false;
}

// Handle search input
function handleRadioSearch(e) {
  radioHighlightIndex = -1;
  searchRadioStations(e.target.value);
}

// Handle arrow/enter keyboard navigation in radio panel
function handleRadioKeydown(e) {
  const items = document.querySelectorAll('#radioPanel .radio-station-item');
  if (!items.length) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    radioHighlightIndex = Math.min(radioHighlightIndex + 1, items.length - 1);
    updateRadioHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    radioHighlightIndex = Math.max(radioHighlightIndex - 1, 0);
    updateRadioHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (radioHighlightIndex >= 0 && radioHighlightIndex < items.length) {
      items[radioHighlightIndex].click();
    }
  }
}

// Update visual highlight on station items
function updateRadioHighlight(items) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === radioHighlightIndex);
  });
  // Scroll highlighted item into view
  if (radioHighlightIndex >= 0 && items[radioHighlightIndex]) {
    items[radioHighlightIndex].scrollIntoView({ block: 'nearest' });
  }
}

