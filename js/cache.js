// ============ Data Cache (Stale-While-Revalidate) ============

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const CACHE_STORAGE_KEY = 'dataCache';

// In-memory cache (loaded from storage on init)
let dataCache = {
  gmail: { data: null, timestamp: 0 },
  meetings: { data: null, timestamp: 0 },
  weather: { data: null, timestamp: 0 },
  assets: { data: null, timestamp: 0 },
  fearGreed: { data: null, timestamp: 0 },
  rss: { data: null, timestamp: 0 },
  wordOfDay: { data: null, timestamp: 0 }
};

// Load cache from chrome.storage.local
async function loadCacheFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get([CACHE_STORAGE_KEY], (result) => {
        if (result[CACHE_STORAGE_KEY]) {
          dataCache = result[CACHE_STORAGE_KEY];
          console.log('Cache loaded from storage');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Save cache to chrome.storage.local
function saveCacheToStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({ [CACHE_STORAGE_KEY]: dataCache });
  }
}

// Check if cache is fresh (within TTL)
function isCacheFresh(key) {
  const cache = dataCache[key];
  if (!cache || !cache.data) return false;
  return (Date.now() - cache.timestamp) < CACHE_TTL_MS;
}

// Get cached data (returns null if no cache)
function getCachedData(key) {
  const cache = dataCache[key];
  return cache ? cache.data : null;
}

// Set cache data
function setCacheData(key, data) {
  dataCache[key] = {
    data: data,
    timestamp: Date.now()
  };
  saveCacheToStorage();
}

// Check if cache exists (even if stale)
function hasCachedData(key) {
  const cache = dataCache[key];
  return cache && cache.data !== null;
}

// Check if cache is fresh until midnight (same calendar day)
function isCacheFreshUntilMidnight(key) {
  const cache = dataCache[key];
  if (!cache || !cache.data) return false;
  const cachedDate = new Date(cache.timestamp).toDateString();
  return cachedDate === new Date().toDateString();
}
