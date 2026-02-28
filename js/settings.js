// ============ Settings Modal ============

// Widget key -> element IDs mapping
const WIDGET_MAP = {
  rssFeed: ['flpTodayPanel'],
  popularSites: ['popularSitesPanel'],
  weather: ['weatherPanel'],
  assets: ['assetsPanel'],
  fearGreed: ['fearGreedPanel'],
  aiChat: ['aiChatPanel'],
  soundsBar: ['soundsBar'],
  lifeCounter: ['lifeCounter'],
  notesTodo: ['notesTodoWidget'],
  newsTicker: ['newsTicker'],
  systemStats: ['systemStats'],
  hackerNews: ['hnWidget'],
  wordOfDay: ['wotdPanel'],
  plant: ['plantWrap'],
};

// Default: all widgets disabled
const DEFAULT_WIDGET_VISIBILITY = Object.fromEntries(
  Object.keys(WIDGET_MAP).map(k => [k, false])
);

// Keys excluded from export/import (sensitive tokens + large ephemeral data)
const EXCLUDED_EXPORT_KEYS = [
  'aiApiKey',
  'aiChatHistory',
  'backgroundImageData',
  'dataCache',
  'focusEndTime',
  'focusSoundClaimed',
  'debugMode',
];

// Widget layout presets
const WIDGET_PRESETS = {
  zen: ['wordOfDay','plant'],
  starter: ['rssFeed','weather','lifeCounter', 'aiChat', 'notesTodo', 'newsTicker', 'systemStats'],
  productive: ['popularSites', 'assets', 'fearGreed', 'soundsBar', 'aiChat', 'notesTodo'],
  fullDeck: Object.keys(WIDGET_MAP),
  explorer: ['rssFeed', 'popularSites', 'weather', 'wordOfDay', 'assets', 'hackerNews','aiChat','newsTicker'],
};

// Column alignment per preset
const DEFAULT_PRESET_ALIGNMENT = { left: 'top', middle: 'top', right: 'top' };
const PRESET_ALIGNMENTS = {
  zen:        { left: 'bottom', middle: 'top', right: 'top' },
  starter:    DEFAULT_PRESET_ALIGNMENT,
  productive: DEFAULT_PRESET_ALIGNMENT,
  explorer:   DEFAULT_PRESET_ALIGNMENT,
  fullDeck:   DEFAULT_PRESET_ALIGNMENT,
};

// Widget key -> init function(s) mapping for lazy loading
const WIDGET_INIT_MAP = {
  rssFeed:      () => initFlpToday(),
  popularSites: () => initPopularSites(),
  weather:      () => initWeather(),
  assets:       () => initAssets(),
  fearGreed:    () => initFearGreed(),
  aiChat:       () => { initAiChat(); initDailyQuote(); },
  soundsBar:    () => initSounds(),
  lifeCounter:  () => initLifeCounter(),
  notesTodo:    () => initNotesTodo(),
  newsTicker:   () => initNews(),
  systemStats:  () => initSystemStats(),
  hackerNews:   () => initHackerNews(),
  wordOfDay:    () => initWordOfDay(),
  plant:        () => initPlant(),
};

// Track which widgets have been initialized (for lazy loading)
const initializedWidgets = new Set();

function visibilityForPreset(presetName) {
  const enabledKeys = WIDGET_PRESETS[presetName] || [];
  const vis = {};
  Object.keys(WIDGET_MAP).forEach(k => { vis[k] = enabledKeys.includes(k); });
  return vis;
}

function detectPresetFromVisibility(vis) {
  for (const [name, keys] of Object.entries(WIDGET_PRESETS)) {
    const expected = visibilityForPreset(name);
    const matches = Object.keys(WIDGET_MAP).every(k => !!vis[k] === !!expected[k]);
    if (matches) return name;
  }
  return 'custom';
}

function selectPresetRadio(presetName) {
  const radio = document.querySelector(`input[name="widgetPreset"][value="${presetName}"]`);
  if (radio) radio.checked = true;
}

// ============ Onboarding ============

let onboardingAnimationId = null;

function stopOnboardingAnimation() {
  if (onboardingAnimationId) {
    cancelAnimationFrame(onboardingAnimationId);
    onboardingAnimationId = null;
  }
}

function dismissOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  
  // Stop ripple pattern immediately
  stopOnboardingRipples();
  // Remove click listener immediately
  document.removeEventListener('click', handleOnboardingClickToRestart);
  
  stopOnboardingAnimation();

  // Animate from current blur/dim to saved defaults over 3 seconds
  const EXIT_DURATION = 3000;
  const startDim = onboardingCurrentDim;
  const startBlur = onboardingCurrentBlur;

  chrome.storage.local.get(['bgDim', 'bgBlur'], (result) => {
    const targetDim = result.bgDim !== undefined ? result.bgDim : 50;
    const targetBlur = result.bgBlur !== undefined ? result.bgBlur : 0;
    const startTime = performance.now();

    function exitStep(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / EXIT_DURATION, 1);
      const ease = 1 - Math.pow(1 - progress, 2);
      const dim = startDim + (targetDim - startDim) * ease;
      const blur = startBlur + (targetBlur - startBlur) * ease;
      applyBackgroundEffects(dim, blur);
      if (progress < 1) {
        requestAnimationFrame(exitStep);
      }
    }
    requestAnimationFrame(exitStep);
  });

  overlay.classList.add('onboarding-fadeout');
  setTimeout(() => {
    overlay.style.display = 'none';
    document.body.classList.remove('onboarding-active');
  }, 500);
  chrome.storage.local.set({ onboardingDone: true });
}

function updateOnboardingText() {
  const hintEl = document.getElementById('onboardingHintText');
  if (hintEl) {
    const hint2 = t('welcomeHint2').replace('{gear}', `<span class="onboarding-gear-icon">${t('gearIcon')}</span>`);
    hintEl.innerHTML = `${t('welcomeHint')}<br>${hint2}`;
  }
}

// Track current onboarding blur/dim for exit transition
let onboardingCurrentDim = 80;
let onboardingCurrentBlur = 25;

function startOnboardingAnimation() {
  const DURATION = 3000; // 5 seconds
  const START_BLUR = 25;
  const TARGET_BLUR = 10;
  const START_DIM = 80;
  const TARGET_DIM = 50;

  onboardingCurrentDim = START_DIM;
  onboardingCurrentBlur = START_BLUR;

  const startTime = performance.now();
  applyBackgroundEffects(START_DIM, START_BLUR);

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / DURATION, 1);
    const ease = 1 - Math.pow(1 - progress, 2);
    onboardingCurrentDim = START_DIM + (TARGET_DIM - START_DIM) * ease;
    onboardingCurrentBlur = START_BLUR + (TARGET_BLUR - START_BLUR) * ease;
    applyBackgroundEffects(onboardingCurrentDim, onboardingCurrentBlur);
    if (progress < 1) {
      onboardingAnimationId = requestAnimationFrame(step);
    } else {
      onboardingAnimationId = null;
    }
  }

  onboardingAnimationId = requestAnimationFrame(step);
}

// Create Zen Pulse effect with random size
function createZenPulse(x, y) {
  const ripple = document.createElement('div');
  
  // Randomly choose size variant for ominous effect
  const sizes = ['small', 'medium', 'large'];
  const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
  
  ripple.className = `zen-pulse ${randomSize}`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);
  
  // Remove ripple after animation completes (longest animation is 4.5s)
  setTimeout(() => {
    ripple.remove();
  }, 4500);
}

let onboardingRippleInterval = null;
let onboardingRippleTimeout = null;

// Start ominous ripple pattern from icon
function startOnboardingRipples() {
  const icon = document.querySelector('.onboarding-icon');
  if (!icon) return;
  
  function emitRipples() {
    const rect = icon.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Emit ripple every 0.8 seconds during active period
    onboardingRippleInterval = setInterval(() => {
      if (!document.body.classList.contains('onboarding-active')) {
        stopOnboardingRipples();
        return;
      }
      createZenPulse(centerX, centerY);
    }, 800);
    
    // Stop after 7 seconds, then resume after 10 seconds break
    onboardingRippleTimeout = setTimeout(() => {
      clearInterval(onboardingRippleInterval);
      onboardingRippleInterval = null;
      
      // Resume after 10 second break
      onboardingRippleTimeout = setTimeout(() => {
        if (document.body.classList.contains('onboarding-active')) {
          emitRipples();
        }
      }, 10000);
    }, 7000);
  }
  
  // Start the pattern
  emitRipples();
}

// Stop ripple pattern
function stopOnboardingRipples() {
  if (onboardingRippleInterval) {
    clearInterval(onboardingRippleInterval);
    onboardingRippleInterval = null;
  }
  if (onboardingRippleTimeout) {
    clearTimeout(onboardingRippleTimeout);
    onboardingRippleTimeout = null;
  }
  
  // Remove all existing ripple elements immediately
  const ripples = document.querySelectorAll('.zen-pulse');
  ripples.forEach(ripple => ripple.remove());
}

// Handle clicks to restart ripples if they're in break period
function handleOnboardingClickToRestart(e) {
  if (!document.body.classList.contains('onboarding-active')) return;
  
  // Don't restart if clicking on the gear button or its children
  const gearBtn = document.getElementById('bgSettingsBtn');
  if (gearBtn && (e.target === gearBtn || gearBtn.contains(e.target))) {
    return;
  }
  
  // If ripples are not currently emitting (in break period), restart them
  if (onboardingRippleInterval === null) {
    stopOnboardingRipples(); // Clear any pending timeout
    startOnboardingRipples(); // Restart the pattern
  }
}

function initOnboarding() {
  const overlay = document.getElementById('onboardingOverlay');
  if (!overlay) return;

  chrome.storage.local.get('onboardingDone', (data) => {
    if (data.onboardingDone) {
      overlay.style.display = 'none';
      return;
    }
    updateOnboardingText();
    // Show the overlay (dismissed only when settings gear is clicked)
    overlay.style.display = '';
    document.body.classList.add('onboarding-active');
    // Start blur/dim reveal animation
    startOnboardingAnimation();
    
    // Start ripple pattern from icon after 3 second delay
    setTimeout(() => {
      if (document.body.classList.contains('onboarding-active')) {
        startOnboardingRipples();
      }
    }, 3000);
    
    // Add click listener to restart ripples if they're in break period
    document.addEventListener('click', handleOnboardingClickToRestart);
  });
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.add('open');
  dismissOnboarding();
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.classList.remove('open');
}

function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;

  const closeBtn = document.getElementById('settingsModalClose');
  const tabs = modal.querySelectorAll('.settings-tab');
  const panels = modal.querySelectorAll('.settings-tab-panel');

  // Close button
  closeBtn.addEventListener('click', closeSettingsModal);

  // Mini gear button opens settings
  const miniGear = document.getElementById('miniGearBtn');
  if (miniGear) miniGear.addEventListener('click', openSettingsModal);

  // Click outside panel to close
  document.addEventListener('click', (e) => {
    if (modal.classList.contains('open') && !modal.contains(e.target)) {
      // Don't close if click was on a settings button that opens it
      const settingsBtn = document.getElementById('bgSettingsBtn');
      if (settingsBtn && settingsBtn.contains(e.target)) return;
      if (miniGear && miniGear.contains(e.target)) return;
      closeSettingsModal();
    }
  });

  // "/" hotkey to toggle settings (only when not in text inputs)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/') return;
    const tag = document.activeElement?.tagName;
    const editable = document.activeElement?.isContentEditable;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
    e.preventDefault();
    if (modal.classList.contains('open')) {
      closeSettingsModal();
    } else {
      openSettingsModal();
    }
  });

  // Tab switching
  const appInfoBar = document.getElementById('settingsAppInfo');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.stab;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.stab === target));
      panels.forEach(p => p.classList.toggle('active', p.dataset.stabPanel === target));
      if (appInfoBar) appInfoBar.style.display = target === 'data' ? 'flex' : 'none';
    });
  });

  // Debug tab easter egg: 5 clicks on empty tab header space to reveal, button to exit
  (function initDebugTabToggle() {
    const tabBar = modal.querySelector('.settings-tabs');
    const debugTab = modal.querySelector('.settings-debug-tab');
    const debugPanel = modal.querySelector('[data-stab-panel="debug"]');
    const debugExitBtn = document.getElementById('debugExitBtn');
    if (!tabBar || !debugTab || !debugPanel) return;

    function showDebug() {
      debugTab.style.display = '';
      chrome.storage.local.set({ debugMode: true });
    }

    function hideDebug() {
      debugTab.style.display = 'none';
      debugPanel.classList.remove('active');
      chrome.storage.local.set({ debugMode: false });
      const widgetsTab = modal.querySelector('[data-stab="widgets"]');
      const widgetsPanel = modal.querySelector('[data-stab-panel="widgets"]');
      tabs.forEach(t => t.classList.toggle('active', t === widgetsTab));
      panels.forEach(p => p.classList.toggle('active', p === widgetsPanel));
    }

    chrome.storage.local.get('debugMode', (r) => {
      if (r.debugMode) debugTab.style.display = '';
    });

    let showClicks = 0, showTimer = 0;
    tabBar.addEventListener('click', (e) => {
      if (e.target.closest('.settings-tab')) return;
      clearTimeout(showTimer);
      showClicks++;
      if (showClicks >= 5) {
        showDebug();
        showClicks = 0;
      }
      showTimer = setTimeout(() => { showClicks = 0; }, 1500);
    });

    if (debugExitBtn) {
      debugExitBtn.addEventListener('click', hideDebug);
    }

    // Corporate user debug toggle
    const corpToggle = document.getElementById('debugCorporateToggle');
    if (corpToggle) {
      corpToggle.checked = document.body.classList.contains('corporate-user');
      corpToggle.addEventListener('change', () => {
        document.body.classList.toggle('corporate-user', corpToggle.checked);
        chrome.storage.local.set({ debugCorporateUser: corpToggle.checked });
        if (corpToggle.checked) {
          enforceCorporateNewsTicker();
        } else {
          // Unlock news ticker toggle
          const row = document.querySelector('.widget-toggle-row[data-widget="newsTicker"]');
          if (row) {
            const cb = row.querySelector('input[type="checkbox"]');
            if (cb) cb.disabled = false;
            row.classList.remove('corporate-locked');
          }
        }
        enforceSystemStatsDependency();
      });
      // Restore saved debug override
      chrome.storage.local.get('debugCorporateUser', (r) => {
        if (r.debugCorporateUser !== undefined) {
          corpToggle.checked = r.debugCorporateUser;
          document.body.classList.toggle('corporate-user', r.debugCorporateUser);
          if (r.debugCorporateUser) enforceCorporateNewsTicker();
        }
      });
    }
  })();

  // Load widget visibility and apply toggles
  const toggleAllCheckbox = document.getElementById('toggleAllWidgets');

  function updateToggleAllState() {
    if (!toggleAllCheckbox) return;
    const rows = modal.querySelectorAll('.widget-toggle-row[data-widget]');
    const allChecked = [...rows].every(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      return cb && cb.checked;
    });
    const noneChecked = [...rows].every(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      return cb && !cb.checked;
    });
    toggleAllCheckbox.checked = allChecked;
    toggleAllCheckbox.indeterminate = !allChecked && !noneChecked;
  }

  chrome.storage.local.get('widgetVisibility', (data) => {
    const visibility = { ...DEFAULT_WIDGET_VISIBILITY, ...(data.widgetVisibility || {}) };

    modal.querySelectorAll('.widget-toggle-row[data-widget]').forEach(row => {
      const key = row.dataset.widget;
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox || !key) return;

      checkbox.checked = visibility[key] !== false;
      applyWidgetVisibility(key, checkbox.checked);

      checkbox.addEventListener('change', () => {
        applyWidgetVisibility(key, checkbox.checked);
        if (key === 'newsTicker') enforceSystemStatsDependency();
        const vis = getWidgetVisibilityFromDOM();
        chrome.storage.local.set({ widgetVisibility: vis });
        updateToggleAllState();
        selectPresetRadio(detectPresetFromVisibility(vis));
      });
    });

    updateToggleAllState();
    enforceSystemStatsDependency();
    // Detect and select the matching preset on load
    selectPresetRadio(detectPresetFromVisibility(visibility));
  });

  // Toggle all widgets on/off
  if (toggleAllCheckbox) {
    toggleAllCheckbox.addEventListener('change', () => {
      const checked = toggleAllCheckbox.checked;
      modal.querySelectorAll('.widget-toggle-row[data-widget]').forEach(row => {
        const key = row.dataset.widget;
        const cb = row.querySelector('input[type="checkbox"]');
        if (!cb || !key) return;
        cb.checked = checked;
        applyWidgetVisibility(key, checked);
      });
      if (document.body.classList.contains('corporate-user')) enforceCorporateNewsTicker();
      enforceSystemStatsDependency();
      const vis = getWidgetVisibilityFromDOM();
      chrome.storage.local.set({ widgetVisibility: vis });
      selectPresetRadio(detectPresetFromVisibility(vis));
    });
  }

  // Preset radio buttons
  modal.querySelectorAll('input[name="widgetPreset"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const presetName = radio.value;
      if (presetName === 'custom') return;
      const vis = visibilityForPreset(presetName);
      modal.querySelectorAll('.widget-toggle-row[data-widget]').forEach(row => {
        const key = row.dataset.widget;
        const cb = row.querySelector('input[type="checkbox"]');
        if (!cb || !key) return;
        cb.checked = !!vis[key];
        applyWidgetVisibility(key, cb.checked);
      });
      if (document.body.classList.contains('corporate-user')) enforceCorporateNewsTicker();
      enforceSystemStatsDependency();
      const updatedVis = getWidgetVisibilityFromDOM();
      chrome.storage.local.set({ widgetVisibility: updatedVis });
      updateToggleAllState();
      applyPresetAlignments(presetName);
    });
  });

  // Export settings
  const exportBtn = document.getElementById('exportSettingsBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      chrome.storage.local.get(null, (data) => {
        const filtered = { ...data };
        EXCLUDED_EXPORT_KEYS.forEach(k => delete filtered[k]);
        if (filtered.plantData) {
          filtered.plantData = { ...filtered.plantData };
          delete filtered.plantData.debugDays;
        }
        const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'zen-launcher-settings.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  // Import settings
  const importBtn = document.getElementById('importSettingsBtn');
  const importFile = document.getElementById('importSettingsFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            alert(t('importInvalidFile'));
            return;
          }
          EXCLUDED_EXPORT_KEYS.forEach(k => delete parsed[k]);
          if (!confirm(t('confirmImportSettings'))) return;
          chrome.storage.local.get(EXCLUDED_EXPORT_KEYS, (sensitive) => {
            chrome.storage.local.clear(() => {
              const restored = { ...parsed };
              EXCLUDED_EXPORT_KEYS.forEach(k => { if (sensitive[k] !== undefined) restored[k] = sensitive[k]; });
              chrome.storage.local.set(restored, () => {
                window.location.reload();
              });
            });
          });
        } catch {
          alert(t('importInvalidFile'));
        }
      };
      reader.readAsText(file);
      importFile.value = '';
    });
  }

  // Clear cache button
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      chrome.storage.local.get(null, (data) => {
        const updated = { ...data };
        delete updated[CACHE_STORAGE_KEY];
        delete updated.historyIndex;
        delete updated.rssIndex;
        chrome.storage.local.clear(() => {
          chrome.storage.local.set(updated, () => {
            window.location.reload();
          });
        });
      });
    });
  }

  // Reset all data button
  const resetBtn = document.getElementById('resetAllDataBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm(t('confirmResetAll'))) return;
      chrome.storage.local.clear(() => {
        window.location.reload();
      });
    });
  }

  // App info: version + Chrome user email + corporate detection
  const versionLabel = document.getElementById('appVersionLabel');
  if (versionLabel) {
    const manifest = chrome.runtime.getManifest();
    versionLabel.textContent = 'v' + manifest.version;
  }
  const emailLabel = document.getElementById('appUserEmail');
  if (emailLabel && chrome.identity && chrome.identity.getProfileUserInfo) {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
      const email = info.email || '';
      emailLabel.textContent = email;
      const domain = email.split('@')[1] || '';
      const isCorporate = domain === 'flp.studio' || domain.includes('fujitsu');
      document.body.classList.toggle('corporate-user', isCorporate);
      if (isCorporate) {
        emailLabel.classList.add('corporate-email');
        enforceCorporateNewsTicker();
      }
    });
  }
}

function getWidgetVisibilityFromDOM() {
  const modal = document.getElementById('settingsModal');
  const vis = {};
  modal.querySelectorAll('.widget-toggle-row').forEach(row => {
    const key = row.dataset.widget;
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (key && checkbox) vis[key] = checkbox.checked;
  });
  return vis;
}

function enforceSystemStatsDependency() {
  const newsRow = document.querySelector('.widget-toggle-row[data-widget="newsTicker"]');
  const newsCb = newsRow ? newsRow.querySelector('input[type="checkbox"]') : null;
  const newsEnabled = newsCb ? newsCb.checked : false;

  const statsRow = document.querySelector('.widget-toggle-row[data-widget="systemStats"]');
  if (!statsRow) return;
  const statsCb = statsRow.querySelector('input[type="checkbox"]');
  if (!statsCb) return;

  if (!newsEnabled) {
    statsCb.checked = false;
    statsCb.disabled = true;
    statsRow.classList.add('corporate-locked');
    applyWidgetVisibility('systemStats', false);
  } else {
    statsCb.disabled = false;
    statsRow.classList.remove('corporate-locked');
  }
}

function enforceCorporateNewsTicker() {
  applyWidgetVisibility('newsTicker', true);
  const row = document.querySelector('.widget-toggle-row[data-widget="newsTicker"]');
  if (row) {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.checked = true;
      cb.disabled = true;
    }
    row.classList.add('corporate-locked');
  }
  chrome.storage.local.get('widgetVisibility', (data) => {
    const vis = { ...(data.widgetVisibility || {}) };
    vis.newsTicker = true;
    chrome.storage.local.set({ widgetVisibility: vis });
  });
  // Re-fetch news from corporate RSS source if ticker was already initialized
  if (initializedWidgets.has('newsTicker')) {
    loadHistoryFresh().then(events => {
      if (events && events.length > 0) {
        newsItems = events;
        currentNewsIndex = 0;
        renderNewsItem();
      }
    });
  }
}

function applyWidgetVisibility(key, visible) {
  if (key === 'newsTicker' && !visible && document.body.classList.contains('corporate-user')) {
    return;
  }
  const ids = WIDGET_MAP[key];
  if (!ids) return;
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (visible) {
        el.style.removeProperty('display');
      } else {
        el.style.setProperty('display', 'none', 'important');
      }
    }
  });
  // Lazy-init: if toggling on and not yet initialized, run init now
  if (visible && !initializedWidgets.has(key) && WIDGET_INIT_MAP[key]) {
    WIDGET_INIT_MAP[key]();
    initializedWidgets.add(key);
  }
  // Auto-hide panel containers when all their children are off
  updateLeftPanelsContainer();
  updateMiddlePanelsContainer();
  // Move controls to bottom when news ticker is hidden
  updateControlsPosition();
  // Move chat up when sounds bar is hidden
  updateChatPosition();
  // Re-evaluate column alignment (expanding widget may have changed)
  reapplyColumnAlignments();
}

const LEFT_PANEL_WIDGETS = ['rssFeed', 'popularSites', 'weather', 'assets', 'fearGreed', 'wordOfDay'];

// Column alignment targets and expanding widgets
const COLUMN_TARGETS = {
  left: '.left-panels-container',
  middle: '.middle-panels-container',
  right: '.right-panels-container'
};
// Widgets that expand (flex:1) and force their column to top alignment
const EXPANDING_WIDGETS = {
  left: [],
  middle: ['aiChatPanel'],
  right: ['notesTodoWidget']
};
// Current alignment state (loaded from storage)
const columnAlignState = { left: 'top', middle: 'top', right: 'top' };

function hasVisibleExpandingWidget(column) {
  return EXPANDING_WIDGETS[column].some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    return getComputedStyle(el).display !== 'none';
  });
}

function applyColumnAlignment(column, align) {
  const container = document.querySelector(COLUMN_TARGETS[column]);
  if (!container) return;
  columnAlignState[column] = align;
  container.classList.remove('align-center', 'align-bottom');
  // When an expanding widget is visible, force top so it can fill space
  if (hasVisibleExpandingWidget(column)) return;
  if (align === 'center') container.classList.add('align-center');
  else if (align === 'bottom') container.classList.add('align-bottom');
}

function reapplyColumnAlignments() {
  ['left', 'middle', 'right'].forEach(col => {
    applyColumnAlignment(col, columnAlignState[col]);
  });
}

function initColumnAlignmentSettings() {
  // Load saved alignment
  chrome.storage.local.get(['alignLeft', 'alignMiddle', 'alignRight'], (data) => {
    columnAlignState.left = data.alignLeft || 'top';
    columnAlignState.middle = data.alignMiddle || 'top';
    columnAlignState.right = data.alignRight || 'top';
    reapplyColumnAlignments();
    // Update button active states
    document.querySelectorAll('.column-align-col').forEach(group => {
      const col = group.dataset.alignColumn;
      if (!col) return;
      group.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === columnAlignState[col]);
      });
    });
  });

  // Listen for clicks on alignment buttons
  document.querySelectorAll('.column-align-col .align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.column-align-col');
      const col = group.dataset.alignColumn;
      const align = btn.dataset.align;
      // Update active state
      group.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Apply and save
      applyColumnAlignment(col, align);
      const storageKey = 'align' + col.charAt(0).toUpperCase() + col.slice(1);
      chrome.storage.local.set({ [storageKey]: align });
    });
  });
}

function applyPresetAlignments(presetName) {
  const aligns = PRESET_ALIGNMENTS[presetName] || DEFAULT_PRESET_ALIGNMENT;
  const storageUpdate = {};
  ['left', 'middle', 'right'].forEach(col => {
    const align = aligns[col];
    applyColumnAlignment(col, align);
    const storageKey = 'align' + col.charAt(0).toUpperCase() + col.slice(1);
    storageUpdate[storageKey] = align;
    // Update button active states
    const group = document.querySelector(`.column-align-col[data-align-column="${col}"]`);
    if (group) {
      group.querySelectorAll('.align-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === align);
      });
    }
  });
  chrome.storage.local.set(storageUpdate);
}

const MIDDLE_PANEL_WIDGETS = ['soundsBar', 'lifeCounter', 'hackerNews', 'aiChat'];

function areAllWidgetsHidden(widgetKeys) {
  return widgetKeys.every(key => {
    const ids = WIDGET_MAP[key];
    if (!ids) return true;
    return ids.every(id => {
      const el = document.getElementById(id);
      return !el || el.style.display === 'none';
    });
  });
}

function updateLeftPanelsContainer() {
  const container = document.querySelector('.left-panels-container');
  if (!container) return;
  const allHidden = areAllWidgetsHidden(LEFT_PANEL_WIDGETS);
  if (allHidden) {
    container.style.setProperty('display', 'none', 'important');
  } else {
    container.style.removeProperty('display');
  }
  document.body.classList.toggle('left-hidden', allHidden);
}

function updateMiddlePanelsContainer() {
  const container = document.querySelector('.middle-panels-container');
  if (!container) return;
  const allHidden = areAllWidgetsHidden(MIDDLE_PANEL_WIDGETS);
  if (allHidden) {
    container.style.setProperty('display', 'none', 'important');
  } else {
    container.style.removeProperty('display');
  }
  document.body.classList.toggle('middle-hidden', allHidden);
}


function updateControlsPosition() {
  const ticker = document.getElementById('newsTicker');
  const tickerHidden = !ticker || ticker.style.display === 'none';

  // Toggle body class so CSS (including media queries) can respond
  document.body.classList.toggle('ticker-hidden', tickerHidden);

  // Controls positioning is handled by CSS using body.ticker-hidden class

  const leftPanels = document.querySelector('.left-panels-container');
  if (leftPanels) {
    if (tickerHidden) {
      leftPanels.style.setProperty('bottom', '10px');
    } else {
      leftPanels.style.removeProperty('bottom');
    }
  }

  const calendarPanel = document.querySelector('.calendar-panel');
  if (calendarPanel) {
    if (tickerHidden) {
      calendarPanel.style.setProperty('bottom', '10px');
    } else {
      calendarPanel.style.removeProperty('bottom');
    }
  }
}

// Middle widgets are now inside .middle-panels-container flex column.
// No manual positioning needed — CSS gap handles spacing.
function updateCenterPanelPositions() {}
function updateChatPosition() {}

function applyAllWidgetVisibility() {
  chrome.storage.local.get('widgetVisibility', (data) => {
    const visibility = { ...DEFAULT_WIDGET_VISIBILITY, ...(data.widgetVisibility || {}) };
    Object.entries(visibility).forEach(([key, visible]) => {
      applyWidgetVisibility(key, visible);
    });
    // Reveal — widgets now have correct inline display styles
    document.body.classList.remove('widgets-loading');
    // Re-run positioning now that elements are visible and measurable
    requestAnimationFrame(() => updateCenterPanelPositions());
  });
}

// ============ Init ============

async function init() {
  // Load cached data first for instant display
  await loadCacheFromStorage();
  
  // Load language first
  await loadLanguage();
  applyTranslations();
  
  // Initialize language settings
  initLanguageSettings();
  
  // Load configured timezones
  configuredTimezones = await getSavedTimezones();
  renderWorldClocks();
  
  // Update clock immediately and every second
  updateClock();
  setInterval(updateClock, 1000);
  
  // Render calendar under clock
  updateClockDateArea();
  
  // Load background image
  loadBackgroundImage();
  
  // Initialize settings modal
  initSettingsModal();
  
  // Apply saved widget visibility
  applyAllWidgetVisibility();
  
  // Initialize onboarding
  initOnboarding();
  
  // Initialize background refresh button
  initBackgroundRefresh();
  
  // Initialize clock settings (united: timezone + display)
  initClockSettings();

  // Resume focus mode if active in another tab
  resumeFocusIfActive();

  // Initialize Zen Pulse
  initZenPulse();

  // Initialize Grayscale Idle
  initGrayscaleIdle();

  // Initialize Background Grayscale
  initBgGrayscale();

  // Initialize column alignment settings
  initColumnAlignmentSettings();
  
  // System stats are now lazy-loaded via WIDGET_INIT_MAP

  // Lazy-load widgets: only initialize enabled ones (skip if already initialized)
  chrome.storage.local.get('widgetVisibility', (data) => {
    const vis = { ...DEFAULT_WIDGET_VISIBILITY, ...(data.widgetVisibility || {}) };
    Object.entries(vis).forEach(([key, enabled]) => {
      if (enabled && !initializedWidgets.has(key) && WIDGET_INIT_MAP[key]) {
        WIDGET_INIT_MAP[key]();
        initializedWidgets.add(key);
      } else if (WIDGET_INIT_MAP[key] && !enabled) {
        console.log(`[LazyLoad] Skipped init for disabled widget: ${key}`);
      }
    });
  });
  
}

init();
