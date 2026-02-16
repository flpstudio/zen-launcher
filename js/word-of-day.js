// ============ Word of the Day Functions ============

const WOTD_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Part-of-speech mapping to i18n keys (abbreviations + full words)
const POS_MAP = {
  'n': 'wotdNoun',
  'v': 'wotdVerb',
  'adj': 'wotdAdj',
  'adv': 'wotdAdv',
  'noun': 'wotdNoun',
  'verb': 'wotdVerb',
  'adjective': 'wotdAdj',
  'adverb': 'wotdAdv',
};

// Clean wikitext markup to plain text
function cleanWikitext(text) {
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove category links [[Category:...|...]]
    .replace(/\[\[Category:[^\]]*\]\]/g, '')
    // Remove [[Appendix:...]] links but keep visible text
    .replace(/\[\[Appendix:[^\]|]*\|([^\]]*)\]\]/g, '$1')
    // Remove file/image links
    .replace(/\[\[File:[^\]]*\]\]/g, '')
    // [[link|display text]] -> display text
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    // [[simple link]] -> simple link
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    // Remove ''italic'' and '''bold'''
    .replace(/'{2,3}/g, '')
    // Remove {{template}} blocks
    .replace(/\{\{[^}]*\}\}/g, '')
    // Remove HTML entities
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    // Remove w: prefix (Wikipedia links)
    .replace(/w:([^|]*)/g, '$1')
    // Clean parenthetical categories like ( biology, uncountable )
    .replace(/\(\s*,\s*/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Parse Wiktionary WOTD wikitext into structured data
function parseWotdWikitext(wikitext) {
  if (!wikitext) return null;

  let word = null;

  // Try primary pattern: '''[[word#Section| word]]'''
  const wordMatch = wikitext.match(/'''\[\[([^#\]]+)#[^\]]*\|\s*([^\]]*)\]\]'''/);
  if (wordMatch) {
    word = wordMatch[2].trim() || wordMatch[1].trim();
  }

  // Fallback: '''[[word| word]]''' (no section anchor)
  if (!word) {
    const fallback1 = wikitext.match(/'''\[\[([^\]|]+)\|\s*([^\]]*)\]\]'''/);
    if (fallback1) word = fallback1[2].trim() || fallback1[1].trim();
  }

  // Fallback: '''[[word]]''' (simple link)
  if (!word) {
    const fallback2 = wikitext.match(/'''\[\[([^\]]+)\]\]'''/);
    if (fallback2) word = fallback2[1].replace(/#.*/, '').trim();
  }

  // Fallback: extract from link= attribute in File tag at top
  if (!word) {
    const linkMatch = wikitext.match(/link=([^#\]|]+)#/);
    if (linkMatch) word = linkMatch[1].trim();
  }

  if (!word) return null;
  // Strip any residual HTML tags from the word
  word = word.replace(/<[^>]*>/g, '').trim();

  // Extract part of speech: ''n'' or ''adjective (qualifier)'' etc.
  const posMatch = wikitext.match(/\]\]'''\s*''([^']+)''/);
  // Strip parenthetical qualifiers like "(chiefly logic, philosophy)"
  const posAbbr = posMatch ? posMatch[1].replace(/\s*\(.*\)/, '').trim() : null;

  // Extract definitions from # and ## lines in document order
  const lines = wikitext.split('\n');
  const definitions = [];
  for (const line of lines) {
    if (!/^#{1,2}\s+/.test(line) || /^#{3,}/.test(line)) continue;
    let cleaned = cleanWikitext(line.replace(/^#+\s+/, ''));
    cleaned = cleaned.replace(/^\([^)]*\)\s*/, '').trim();
    if (cleaned && cleaned.length > 10) {
      definitions.push(cleaned);
    }
  }

  // Fallback: extract from WOTD-rss-description div content
  if (definitions.length === 0) {
    const descMatch = wikitext.match(/WOTD-rss-description">\s*([\s\S]*?)(?:\n\||\n<\/div>)/);
    if (descMatch) {
      const descText = descMatch[1];
      // Try extracting from <li> or <ol> items
      const liMatches = descText.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (liMatches) {
        for (const li of liMatches) {
          let cleaned = cleanWikitext(li).replace(/^\([^)]*\)\s*/, '').trim();
          if (cleaned && cleaned.length > 5) definitions.push(cleaned);
        }
      }
      // Or just use the whole description text
      if (definitions.length === 0) {
        let cleaned = cleanWikitext(descText).replace(/^\([^)]*\)\s*/, '').trim();
        if (cleaned && cleaned.length > 5) definitions.push(cleaned);
      }
    }
  }

  // Extract fun fact (PointingHand line)
  let funFact = null;
  const funFactLine = lines.find(l => l.includes('PointingHand.svg'));
  if (funFactLine) {
    funFact = cleanWikitext(funFactLine.replace(/\[\[File:PointingHand\.svg\|[^\]]*\]\]\s*/, ''));
  }

  return {
    word,
    partOfSpeech: posAbbr,
    definitions: definitions.slice(0, 2), // Max 2 definitions
    funFact
  };
}

// Fetch Word of the Day from Wiktionary
async function fetchWordOfDay() {
  const now = new Date();
  const year = now.getFullYear();
  const month = WOTD_MONTH_NAMES[now.getMonth()];
  const day = now.getDate();

  const templatePage = `Wiktionary:Word_of_the_day/${year}/${month}_${day}`;
  const url = `https://en.wiktionary.org/w/api.php?action=expandtemplates&text={{${encodeURIComponent(templatePage)}}}&prop=wikitext&format=json&origin=*`;

  console.log('[WOTD] Fetching:', templatePage);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const wikitext = data?.expandtemplates?.wikitext;
  if (!wikitext) throw new Error('No wikitext in response');

  let parsed = parseWotdWikitext(wikitext);

  // If today's page fails to parse, try yesterday (page may not exist yet)
  if (!parsed || !parsed.word) {
    console.warn('[WOTD] Failed to parse today, trying yesterday');
    const yesterday = new Date(now.getTime() - 86400000);
    const yYear = yesterday.getFullYear();
    const yMonth = WOTD_MONTH_NAMES[yesterday.getMonth()];
    const yDay = yesterday.getDate();
    const yPage = `Wiktionary:Word_of_the_day/${yYear}/${yMonth}_${yDay}`;
    const yUrl = `https://en.wiktionary.org/w/api.php?action=expandtemplates&text={{${encodeURIComponent(yPage)}}}&prop=wikitext&format=json&origin=*`;
    const yResp = await fetch(yUrl);
    if (yResp.ok) {
      const yData = await yResp.json();
      const yWiki = yData?.expandtemplates?.wikitext;
      if (yWiki) parsed = parseWotdWikitext(yWiki);
    }
  }

  if (!parsed || !parsed.word) throw new Error('Failed to parse WOTD');

  console.log('[WOTD] Parsed:', parsed.word, parsed.partOfSpeech);
  return parsed;
}

// Render Word of the Day widget
function renderWordOfDay(data) {
  const container = document.getElementById('wotdContent');
  if (!container) return;

  if (!data || !data.word) {
    container.innerHTML = `<div class="wotd-error">${t('wotdError')}</div>`;
    return;
  }

  // Translate part of speech (also handle stale cached data with full qualifiers)
  const rawPos = data.partOfSpeech ? data.partOfSpeech.replace(/\s*\(.*\)/, '').trim() : null;
  const posKey = rawPos ? POS_MAP[rawPos] : null;
  const posLabel = posKey ? t(posKey) : (rawPos || '');

  // Take first definition
  const definition = data.definitions && data.definitions.length > 0
    ? data.definitions[0]
    : '';

  // Wiktionary link for the word
  const wordUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(data.word)}`;

  container.innerHTML = `
    <a href="${wordUrl}" target="_blank" rel="noopener" class="wotd-word">${escapeHtml(data.word)}</a>
    ${posLabel ? `<span class="wotd-pos">${escapeHtml(posLabel)}</span>` : ''}
    ${definition ? `<a href="${wordUrl}" target="_blank" rel="noopener" class="wotd-definition">${escapeHtml(definition)}</a>` : ''}
  `;
}

// Initialize Word of the Day widget
async function initWordOfDay() {
  console.log('[WOTD] initWordOfDay called');
  const container = document.getElementById('wotdContent');
  if (!container) return;

  // Show cached data immediately if available, still today, and has definitions
  if (hasCachedData('wordOfDay') && isCacheFreshUntilMidnight('wordOfDay')) {
    const cached = getCachedData('wordOfDay');
    if (cached && cached.definitions && cached.definitions.length > 0) {
      console.log('[WOTD] Showing cached data:', cached?.word);
      renderWordOfDay(cached);
      return;
    }
    console.log('[WOTD] Cached data incomplete, re-fetching');
  }

  // No valid cache, fetch fresh
  container.innerHTML = `<div class="wotd-loading">${t('loading')}</div>`;
  try {
    const data = await fetchWordOfDay();
    setCacheData('wordOfDay', data);
    renderWordOfDay(data);
  } catch (err) {
    console.error('[WOTD] Error:', err);
    container.innerHTML = `<div class="wotd-error">${t('wotdError')}</div>`;
  }

  // Schedule refresh at midnight
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = midnight.getTime() - now.getTime() + 5000; // +5s buffer
  console.log('[WOTD] Next refresh in', Math.round(msUntilMidnight / 60000), 'minutes');
  setTimeout(async () => {
    try {
      const data = await fetchWordOfDay();
      setCacheData('wordOfDay', data);
      renderWordOfDay(data);
    } catch (err) {
      console.error('[WOTD] Midnight refresh error:', err);
    }
  }, msUntilMidnight);
}
