// ============ RSS Feed Functions ============

const DEFAULT_RSS_URL = 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml';
const CORPORATE_RSS_URL = 'https://rss.app/feeds/Y8WSVlB8HYNIvw0k.xml';

const RSS_PRESETS_NYT = [
  { i18nKey: 'rssNytTop', label: 'Top Stories', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { i18nKey: 'rssNytWorld', label: 'World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { i18nKey: 'rssNytTech', label: 'Technology', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { i18nKey: 'rssNytScience', label: 'Science', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml' },
  { i18nKey: 'rssNytBusiness', label: 'Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { i18nKey: 'rssNytHealth', label: 'Health', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml' },
  { i18nKey: 'rssNytArts', label: 'Arts', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml' },
  { i18nKey: 'rssNytSports', label: 'Sports', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml' },
  { i18nKey: 'rssNytTravel', label: 'Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml' },
  { i18nKey: 'rssNytMostViewed', label: 'Most Viewed', url: 'https://rss.nytimes.com/services/xml/rss/nyt/MostViewed.xml' },
  { i18nKey: 'rssNytMovies', label: 'Movies', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml' },
];


function getDefaultRssUrl() {
  return DEFAULT_RSS_URL;
}
let rssItems = [];
let currentRssIndex = 0;
let rssRotationInterval = null;

// Get RSS URL from storage
async function getRssUrl() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['rssUrl'], (result) => {
        resolve(result.rssUrl || getDefaultRssUrl());
      });
    } else {
      resolve(getDefaultRssUrl());
    }
  });
}

// Save RSS URL to storage
async function saveRssUrl(url) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ rssUrl: url }, resolve);
    } else {
      resolve();
    }
  });
}

// Decode HTML entities in a string
function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

// Parse RSS feed XML (supports both RSS 2.0 and Atom formats)
function parseRssFeed(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  // Detect Atom feed (<feed> root element)
  const isAtom = xmlDoc.documentElement.tagName === 'feed' ||
    xmlDoc.documentElement.namespaceURI === 'http://www.w3.org/2005/Atom';
  
  if (isAtom) {
    return parseAtomFeed(xmlDoc);
  }
  
  return parseRss2Feed(xmlDoc);
}

// Parse RSS 2.0 feed
function parseRss2Feed(xmlDoc) {
  const items = xmlDoc.querySelectorAll('item');
  const rawFeedTitle = xmlDoc.querySelector('channel > title')?.textContent || 'RSS Feed';
  const feedTitle = decodeHtmlEntities(rawFeedTitle);
  
  const parsedItems = [];
  items.forEach((item, index) => {
    // No item limit — rotate all feed items
    
    const rawTitle = item.querySelector('title')?.textContent || t('noTitle');
    const title = decodeHtmlEntities(rawTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'));
    const description = item.querySelector('description')?.textContent || '';
    const link = item.querySelector('link')?.textContent || null;
    const pubDate = item.querySelector('pubDate')?.textContent || null;
    
    // Get content:encoded (full HTML body) — try multiple selectors for namespace compatibility
    let contentEncoded = '';
    const encodedEl = item.getElementsByTagName('content:encoded')[0]
      || item.querySelector('encoded');
    if (encodedEl) {
      contentEncoded = encodedEl.textContent || '';
    }
    
    // Try to get image from multiple sources
    let image = null;
    // 1. media:content url attribute
    const mediaContent = item.querySelector('content[url]');
    if (mediaContent) {
      image = mediaContent.getAttribute('url');
    }
    // 2. <img> in description HTML
    if (!image && description) {
      const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) image = imgMatch[1];
    }
    // 3. <img> in content:encoded HTML (pick first sizeable image, skip icons/avatars)
    if (!image && contentEncoded) {
      const imgMatches = [...contentEncoded.matchAll(/<img[^>]+src="([^"]+)"/g)];
      for (const m of imgMatches) {
        let src = m[1].replace(/&amp;/g, '&');
        // Skip tiny thumbnails (often 50x50 or 100x100 icons)
        if (/w=5[0]&|w=100&|w=150&/.test(src)) continue;
        // Prefer a reasonable resolution (add width param if missing for large images)
        image = src;
        break;
      }
    }
    // 4. hiresJpeg element (NASA Photojournal feeds)
    if (!image) {
      const hiresEl = item.querySelector('hiresJpeg');
      if (hiresEl) image = hiresEl.textContent?.trim() || null;
    }
    
    // Clean description (remove HTML tags), fall back to content:encoded summary
    let rawDesc = description;
    if (!rawDesc && contentEncoded) {
      // Extract text from first <p> in content:encoded
      const pMatch = contentEncoded.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      if (pMatch) rawDesc = pMatch[1];
    }
    const cleanDescription = rawDesc
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/^\s*Description\s+/i, '') // NASA Photojournal feeds prefix with "Description "
      .trim()
      .slice(0, 200);
    
    // Full description for hover popup (longer limit)
    const fullDescription = rawDesc
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/^\s*Description\s+/i, '')
      .trim()
      .slice(0, 600);

    parsedItems.push({
      title,
      description: cleanDescription,
      fullDescription,
      url: link,
      image: image,
      pubDate: pubDate
    });
  });
  
  return { feedTitle, items: parsedItems };
}

// Parse Atom feed
function parseAtomFeed(xmlDoc) {
  const entries = xmlDoc.querySelectorAll('entry');
  const rawFeedTitle = xmlDoc.querySelector('feed > title')?.textContent || 'Atom Feed';
  const feedTitle = decodeHtmlEntities(rawFeedTitle);
  
  const parsedItems = [];
  entries.forEach((entry) => {
    const rawTitle = entry.querySelector('title')?.textContent || t('noTitle');
    const title = decodeHtmlEntities(rawTitle.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'));
    
    // Atom links use href attribute; prefer rel="alternate" or the first link
    let link = null;
    const links = entry.querySelectorAll('link');
    for (const l of links) {
      const rel = l.getAttribute('rel') || 'alternate';
      if (rel === 'alternate') {
        link = l.getAttribute('href');
        break;
      }
    }
    if (!link && links.length > 0) {
      link = links[0].getAttribute('href');
    }
    
    // Date: <published> or <updated>
    const pubDate = entry.querySelector('published')?.textContent
      || entry.querySelector('updated')?.textContent
      || null;
    
    // Content: <content> or <summary>
    const contentEl = entry.querySelector('content');
    const summaryEl = entry.querySelector('summary');
    const contentHtml = contentEl?.textContent || '';
    const summaryHtml = summaryEl?.textContent || '';
    const rawHtml = contentHtml || summaryHtml;
    
    // Try to extract image
    let image = null;
    // 1. media:thumbnail or media:content
    const mediaThumbnail = entry.querySelector('thumbnail[url]')
      || entry.querySelector('content[url][type^="image"]');
    if (mediaThumbnail) {
      image = mediaThumbnail.getAttribute('url');
    }
    // 2. <img> in content HTML
    if (!image && rawHtml) {
      const imgMatch = rawHtml.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) image = imgMatch[1];
    }
    
    // Clean description
    const cleanDescription = rawHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .slice(0, 200);
    
    const fullDescription = rawHtml
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .slice(0, 600);
    
    parsedItems.push({
      title,
      description: cleanDescription,
      fullDescription,
      url: link,
      image: image,
      pubDate: pubDate
    });
  });
  
  return { feedTitle, items: parsedItems };
}

// Update RSS feed title in the UI
function updateRssFeedTitle(feedTitle) {
  const titleEl = document.getElementById('rssFeedTitle');
  if (titleEl && feedTitle) {
    // Extract just the main title part and truncate if too long
    let shortTitle = feedTitle.split('|')[0].split('-')[0].split(':')[0].trim() || t('newsSites');
    if (shortTitle.length > 24) {
      shortTitle = shortTitle.slice(0, 22) + '…';
    }
    titleEl.textContent = shortTitle;
  }
}

// Fetch RSS feed
async function fetchRssFeed() {
  try {
    const rssUrl = await getRssUrl();
    console.log('Fetching RSS feed from:', rssUrl);
    
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xmlText = await response.text();
    const { feedTitle, items } = parseRssFeed(xmlText);
    
    updateRssFeedTitle(feedTitle);
    
    return { feedTitle, items };
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return { feedTitle: null, items: [] };
  }
}

// Render RSS item content
function renderRssItem(data) {
  const content = document.getElementById('flpTodayContent');
  
  if (!data) {
    content.innerHTML = `<div class="flp-today-empty">${t('noContentAvailable')}</div>`;
    return;
  }
  
  // Navigation arrows (only when more than 1 item)
  const arrowsHtml = rssItems.length > 1
    ? `<button class="rss-nav-arrow rss-nav-prev" title="Previous">&#8249;</button><button class="rss-nav-arrow rss-nav-next" title="Next">&#8250;</button>`
    : '';

  // Hover text overlay on the image area (only if description available) — clickable to open link
  const descText = data.fullDescription || data.description || '';
  const overlayTag = data.url ? `a href="${escapeHtml(data.url)}" target="_blank"` : 'div';
  const overlayCloseTag = data.url ? 'a' : 'div';
  const hoverOverlayHtml = descText
    ? `<${overlayTag} class="rss-hover-overlay"><div class="rss-hover-overlay-text">${escapeHtml(descText)}</div></${overlayCloseTag}>`
    : '';

  // If no image, show newspaper-style text excerpt
  const imageHtml = data.image 
    ? `<div class="flp-today-image-wrapper"><img class="flp-today-image" src="${escapeHtml(data.image)}" alt="">${hoverOverlayHtml}${arrowsHtml}</div>`
    : `<div class="flp-today-image-wrapper"><div class="rss-text-preview">${escapeHtml(data.description || data.title)}</div>${arrowsHtml}</div>`;
  
  const titleHtml = data.url 
    ? `<a href="${escapeHtml(data.url)}" target="_blank">${escapeHtml(data.title)}</a>`
    : escapeHtml(data.title);
  
  content.innerHTML = `
    <div class="flp-today-item">
      ${imageHtml}
      <div class="flp-today-info">
        <div class="flp-today-item-title">${titleHtml}</div>
      </div>
    </div>
  `;

  // Update item date in the widget header
  const dateEl = document.getElementById('flpTodayDate');
  if (dateEl) {
    dateEl.textContent = data.pubDate
      ? new Date(data.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  }
  
  // Add image error handler - show text preview on error
  const img = content.querySelector('.flp-today-image');
  if (img) {
    img.addEventListener('error', () => {
      const wrapper = img.parentNode;
      const arrows = wrapper.querySelectorAll('.rss-nav-arrow');
      const arrowsMarkup = Array.from(arrows).map(a => a.outerHTML).join('');
      wrapper.innerHTML = `<div class="rss-text-preview">${escapeHtml(data.description || data.title)}</div>${arrowsMarkup}`;
      // Re-attach arrow listeners after replacing content
      attachArrowListeners(wrapper);
    });
  }

  // Attach arrow click listeners
  const wrapper = content.querySelector('.flp-today-image-wrapper');
  if (wrapper) attachArrowListeners(wrapper);
}


function attachArrowListeners(wrapper) {
  const prevBtn = wrapper.querySelector('.rss-nav-prev');
  const nextBtn = wrapper.querySelector('.rss-nav-next');
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateRss(-1); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigateRss(1); });
}

// Navigate RSS items manually (direction: -1 for prev, 1 for next)
function navigateRss(direction) {
  if (rssItems.length === 0) return;

  currentRssIndex = (currentRssIndex + direction + rssItems.length) % rssItems.length;
  renderRssItem(rssItems[currentRssIndex]);

  // Reset rotation timer so it restarts from now
  if (rssRotationInterval) {
    clearInterval(rssRotationInterval);
  }
  if (rssItems.length > 1) {
    rssRotationInterval = setInterval(rotateRssItem, 20000);
  }

  // Persist position
  chrome.storage.local.set({ rssIndex: currentRssIndex });
}

// Rotate to next RSS item
function rotateRssItem() {
  if (rssItems.length === 0) return;
  
  currentRssIndex = (currentRssIndex + 1) % rssItems.length;
  renderRssItem(rssItems[currentRssIndex]);
  // Persist position after auto-rotation
  chrome.storage.local.set({ rssIndex: currentRssIndex });
}

// Render RSS items and start rotation
function displayRssItems(items) {
  const content = document.getElementById('flpTodayContent');
  
  if (!items || items.length === 0) {
    content.innerHTML = `<div class="flp-today-empty">${t('noFeedItems')}</div>`;
    return;
  }
  
  rssItems = items;

  // Restore saved position from storage, then render
  chrome.storage.local.get(['rssIndex'], (result) => {
    const savedIndex = result.rssIndex;
    if (typeof savedIndex === 'number' && savedIndex >= 0 && savedIndex < rssItems.length) {
      currentRssIndex = savedIndex;
    } else {
      currentRssIndex = 0;
    }
    renderRssItem(rssItems[currentRssIndex]);

    // Start rotation if more than 1 item
    if (rssRotationInterval) {
      clearInterval(rssRotationInterval);
    }
    if (rssItems.length > 1) {
      rssRotationInterval = setInterval(rotateRssItem, 20000);
    }
  });
}

// Fetch RSS fresh and cache
async function fetchRssFresh() {
  console.log('[RSS] Fetching fresh data...');
  const result = await fetchRssFeed();
  if (result.items && result.items.length > 0) {
    setCacheData('rss', { feedTitle: result.feedTitle, items: result.items });
    console.log('[RSS] Cached', result.items.length, 'items');
  }
  return result;
}

// Load and display RSS feed (with stale-while-revalidate caching)
async function loadRssFeed(forceRefresh = false) {
  const content = document.getElementById('flpTodayContent');
  
  // Show cached data immediately if available
  if (hasCachedData('rss') && !forceRefresh) {
    const cached = getCachedData('rss');
    // Support both old format (array) and new format ({ feedTitle, items })
    const cachedItems = Array.isArray(cached) ? cached : (cached.items || []);
    const cachedTitle = Array.isArray(cached) ? null : cached.feedTitle;
    if (cachedTitle) updateRssFeedTitle(cachedTitle);
    displayRssItems(cachedItems);
    console.log('[RSS] Showing cached data');
    
    // If cache is fresh, don't refetch
    if (isCacheFresh('rss')) {
      console.log('[RSS] Cache is fresh, skipping fetch');
      return;
    }
    
    // Cache is stale, fetch in background
    console.log('[RSS] Cache stale, refreshing in background');
    fetchRssFresh().then(result => {
      if (result.items && result.items.length > 0) {
        displayRssItems(result.items);
      }
    });
    return;
  }
  
  // No cache or force refresh, show loading and fetch
  content.innerHTML = `<div class="flp-today-loading">${t('loadingFeed')}</div>`;
  const result = await fetchRssFresh();
  displayRssItems(result.items);
}

// Initialize RSS Settings panel
function initRssSettings() {
  const panel = document.getElementById('rssSettingsPanel');
  const btn = document.getElementById('rssSettingsBtn');
  const saveBtn = document.getElementById('rssSettingsSave');
  const resetBtn = document.getElementById('rssSettingsReset');
  const urlInput = document.getElementById('rssUrlInput');
  
  // Toggle panel
  btn.addEventListener('click', async () => {
    const currentUrl = await getRssUrl();
    urlInput.value = currentUrl;
    panel.classList.toggle('open');
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (panel && panel.classList.contains('open')) {
      if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.remove('open');
      }
    }
  });
  
  // Save URL
  saveBtn.addEventListener('click', async () => {
    const newUrl = urlInput.value.trim();
    if (newUrl) {
      await saveRssUrl(newUrl);
      // Invalidate old cache so stale items from the previous feed never show
      setCacheData('rss', null);
      panel.classList.remove('open');
      loadRssFeed(true); // Force refresh when URL changes
    }
  });
  
  // Reset to default
  resetBtn.addEventListener('click', async () => {
    const defaultUrl = getDefaultRssUrl();
    urlInput.value = defaultUrl;
    await saveRssUrl(defaultUrl);
    // Invalidate old cache so stale items from the previous feed never show
    setCacheData('rss', null);
    panel.classList.remove('open');
    loadRssFeed(true); // Force refresh when URL changes
  });

  // Render RSS presets
  renderRssPresets('rssPresetsGrid', RSS_PRESETS_NYT, urlInput, panel);
}

function renderRssPresets(containerId, presets, urlInput, panel) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  getRssUrl().then(currentUrl => {
    grid.innerHTML = presets.map(p => {
      const active = currentUrl === p.url ? ' active' : '';
      return `<button class="rss-preset-btn${active}" data-rss-url="${p.url}">${t(p.i18nKey) || p.label}</button>`;
    }).join('');

    grid.querySelectorAll('.rss-preset-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.rssUrl;
        urlInput.value = url;
        await saveRssUrl(url);
        setCacheData('rss', null);
        // Update active state across all preset grids
        document.querySelectorAll('.rss-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        panel.classList.remove('open');
        loadRssFeed(true);
      });
    });
  });
}

// Initialize RSS Feed
function initFlpToday() {
  // Show cached data immediately on init
  if (hasCachedData('rss')) {
    const cached = getCachedData('rss');
    const cachedItems = Array.isArray(cached) ? cached : (cached.items || []);
    const cachedTitle = Array.isArray(cached) ? null : cached.feedTitle;
    if (cachedTitle) updateRssFeedTitle(cachedTitle);
    displayRssItems(cachedItems);
    console.log('[RSS] Showing cached data on init');
  }
  
  loadRssFeed();
  initRssSettings();
  
  // Refresh feed every 10 minutes
  setInterval(() => {
    console.log('[RSS] Auto-refresh triggered');
    fetchRssFresh().then(result => {
      if (result.items && result.items.length > 0) {
        displayRssItems(result.items);
      }
    });
  }, 10 * 60 * 1000);
}

