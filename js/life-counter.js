// ============ Life Counter Widget ============

const LIFE_COUNTER_STORAGE_KEY = 'lifeCounterData';
let lifeCounterData = { birthdate: null, expectancy: 80, moods: {} };
const LC_MOOD_EMOJIS = ['😫', '😟', '😐', '😊', '🤩'];

function getTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function initLifeCounter() {
  const lifeCounter = document.getElementById('lifeCounter');
  const mementoState = document.getElementById('lifeCounterMementoState');
  const activeState = document.getElementById('lifeCounterActive');
  const settingsBtnMemento = document.getElementById('lifeCounterSettingsBtnMemento');
  const settingsBtn = document.getElementById('lifeCounterSettingsBtn');
  const settingsPanel = document.getElementById('lifeCounterSettingsPanel');
  const birthdateInput = document.getElementById('lifeCounterBirthdate');
  const closeBtn = document.getElementById('lifeCounterCloseBtn');
  const expectancyInput = document.getElementById('lifeCounterExpectancy');
  const expectancyValue = document.getElementById('lifeCounterExpectancyValue');
  const percentageDisplay = document.getElementById('lifeCounterPercentage');
  const progressBar = document.getElementById('lifeCounterBar');
  const moodBar = document.getElementById('lcMoodBar');
  const statsBtn = document.getElementById('lcStatsBtn');
  const statsPanel = document.getElementById('lcStatsPanel');

  if (!lifeCounter) return;

  chrome.storage.local.get([LIFE_COUNTER_STORAGE_KEY], (result) => {
    if (result[LIFE_COUNTER_STORAGE_KEY]) {
      lifeCounterData = { moods: {}, ...result[LIFE_COUNTER_STORAGE_KEY] };
    }
    updateDisplayState();
    updateMoodBar();
  });

  function updateDisplayState() {
    if (lifeCounterData.birthdate) {
      if (mementoState) mementoState.style.display = 'none';
      if (activeState) activeState.style.display = 'flex';
      renderProgressbar();
    } else {
      if (mementoState) mementoState.style.display = 'flex';
      if (activeState) activeState.style.display = 'none';
    }
  }

  // --- Settings panel handlers ---
  if (settingsBtnMemento) {
    settingsBtnMemento.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSettingsPanel();
    });
  }

  const saveBtn = document.getElementById('lifeCounterSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveLifeCounterData();
      updateDisplayState();
      closeSettingsPanel();
    });
  }

  if (birthdateInput) {
    birthdateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        lifeCounterData.birthdate = e.target.value;
        saveLifeCounterData();
        updateDisplayState();
      }
    });
  }

  if (expectancyInput && expectancyValue) {
    expectancyInput.addEventListener('input', () => {
      expectancyValue.textContent = expectancyInput.value;
      lifeCounterData.expectancy = parseInt(expectancyInput.value);
      saveLifeCounterData();
      renderProgressbar();
    });
  }

  // --- Tooltip on widget hover ---
  if (activeState) {
    activeState.addEventListener('mouseenter', handleProgressbarHover);
    activeState.addEventListener('mouseleave', () => {
      const panelOpen = (statsPanel && statsPanel.classList.contains('open')) ||
        (settingsPanel && settingsPanel.classList.contains('open'));
      if (panelOpen) return;
      const tooltipEl = document.getElementById('lifeCounterTooltip');
      if (tooltipEl) tooltipEl.style.opacity = '0';
    });
    activeState.addEventListener('click', (e) => {
      if (e.target.closest('.lc-mood-btn') || e.target.closest('.lc-stats-btn')) return;
      const todayMood = lifeCounterData.moods[getTodayKey()];
      if (todayMood !== undefined) {
        e.stopPropagation();
        if (statsPanel && statsPanel.classList.contains('open')) {
          closeStatsPanel();
        } else {
          openStatsPanel();
        }
      }
    });
  }

  // --- Mood bar ---
  if (moodBar) {
    moodBar.querySelectorAll('.lc-mood-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mood = parseInt(btn.dataset.mood);
        const today = getTodayKey();
        lifeCounterData.moods[today] = mood;
        saveLifeCounterData();
        updateMoodBar();
      });
    });
  }

  function updateMoodBar() {
    if (!moodBar) return;
    const today = getTodayKey();
    const todayMood = lifeCounterData.moods[today];
    const logged = todayMood !== undefined;

    moodBar.classList.toggle('lc-mood-logged', logged);
    moodBar.querySelectorAll('.lc-mood-btn').forEach(btn => {
      const m = parseInt(btn.dataset.mood);
      btn.classList.toggle('lc-mood-selected', logged && m === todayMood);
    });
    updateLifeScore();
  }

  function updateLifeScore() {
    const el = document.getElementById('lcLifeScore');
    if (!el) return;
    const moods = Object.values(lifeCounterData.moods || {});
    if (moods.length === 0) {
      el.textContent = '';
      return;
    }
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    el.textContent = avg.toFixed(1);
    el.style.color = getMoodColor(avg);
  }

  // --- Stats panel ---
  if (statsBtn) {
    statsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (statsPanel && statsPanel.classList.contains('open')) {
        closeStatsPanel();
      } else {
        openStatsPanel();
      }
    });
  }

  function openStatsPanel() {
    if (!statsPanel || !lifeCounter) return;
    closeSettingsPanel();

    const rect = lifeCounter.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    statsPanel.classList.remove('position-above', 'position-below');
    if (spaceAbove > spaceBelow && spaceAbove > 320) {
      statsPanel.classList.add('position-above');
    } else {
      statsPanel.classList.add('position-below');
    }

    renderStatsContent();
    statsPanel.classList.add('open');
    handleProgressbarHover();
  }

  function closeStatsPanel() {
    if (statsPanel) statsPanel.classList.remove('open');
    if (!lifeCounter.matches(':hover')) {
      const tooltipEl = document.getElementById('lifeCounterTooltip');
      if (tooltipEl) tooltipEl.style.opacity = '0';
    }
  }

  function renderStatsContent() {
    const container = document.getElementById('lcStatsContent');
    if (!container) return;

    let html = '';

    if (lifeCounterData.birthdate) {
      const calc = calculateLifeProgress(lifeCounterData.birthdate, lifeCounterData.expectancy);
      const monthsLeft = Math.max(0, calc.totalMonths - calc.monthsLived);
      const yearsLived = Math.floor(calc.ageYears);
      const yearsLeft = Math.max(0, lifeCounterData.expectancy - yearsLived);

      html += `<div class="lc-stats-section-title">${t('lcStatsTitle')}</div>`;
      html += `<div class="lc-stats-row">`;
      html += `<span class="lc-stat-label">${t('lifeCounterMonths')}</span>`;
      html += `<span><span class="lc-stat-value-lived">${calc.monthsLived} ${t('lifeCounterLived').toLowerCase()}</span> / <span class="lc-stat-value-left">${monthsLeft} ${t('lifeCounterLeft').toLowerCase()}</span></span>`;
      html += `</div>`;
      html += `<div class="lc-stats-row">`;
      html += `<span class="lc-stat-label">${t('lifeCounterYears')}</span>`;
      html += `<span><span class="lc-stat-value-lived">${yearsLived} ${t('lifeCounterLived').toLowerCase()}</span> / <span class="lc-stat-value-left">${yearsLeft} ${t('lifeCounterLeft').toLowerCase()}</span></span>`;
      html += `</div>`;
    }

    html += `<div class="lc-stats-divider"></div>`;

    const lifeMoods = filterMoodsByPeriod('life');
    let lifeAvg = 0;
    if (lifeMoods.length > 0) {
      lifeAvg = lifeMoods.reduce((a, b) => a + b, 0) / lifeMoods.length;
    }
    const lifeAvgStr = lifeMoods.length > 0 ? lifeAvg.toFixed(1) : '—';
    const lifeAvgColor = lifeMoods.length > 0 ? getMoodColor(lifeAvg) : 'rgba(255,255,255,0.35)';

    html += `<div class="lc-stats-section-title"><span>${t('lcMoodTitle')}</span><span class="lc-mood-lifetime-score" style="color:${lifeAvgColor}">${lifeAvgStr}</span></div>`;

    const todayKey = getTodayKey();
    const todayMood = lifeCounterData.moods[todayKey];
    html += `<div class="lc-mood-stacked-group lc-mood-today-group">`;
    html += `<div class="lc-mood-stacked-header"><span class="lc-mood-stacked-label">${t('lcMoodPeriodToday')}</span></div>`;
    html += `<div class="lc-mood-today-picker">`;
    for (let i = 0; i < 5; i++) {
      const sel = todayMood === (i + 1) ? ' lc-mood-today-selected' : '';
      html += `<button class="lc-mood-today-btn${sel}" data-mood="${i + 1}">${LC_MOOD_EMOJIS[i]}</button>`;
    }
    html += `</div></div>`;

    const periods = ['week', 'month', 'quarter', 'year', 'life'];
    const periodLabels = { week: t('lcMoodPeriodWeek'), month: t('lcMoodPeriodMonth'), quarter: t('lcMoodPeriodQuarter'), year: t('lcMoodPeriodYear'), life: t('lcMoodPeriodLife') };

    periods.forEach(period => {
      const filtered = filterMoodsByPeriod(period);
      const total = filtered.length;

      let avg = '—';
      if (total > 0) {
        const sum = filtered.reduce((a, b) => a + b, 0);
        avg = (sum / total).toFixed(1);
      }

      html += `<div class="lc-mood-stacked-group">`;
      html += `<div class="lc-mood-stacked-header">`;
      html += `<span class="lc-mood-stacked-label">${periodLabels[period]}</span>`;
      html += `<span class="lc-mood-stacked-avg">${avg}</span>`;
      html += `</div>`;
      if (total === 0) {
        html += `<div class="lc-mood-stacked-bar-wrap"><div class="lc-mood-stacked-empty"></div></div>`;
      } else {
        const counts = [0, 0, 0, 0, 0];
        filtered.forEach(v => { if (v >= 1 && v <= 5) counts[v - 1]++; });
        const tipParts = [];
        for (let i = 0; i < 5; i++) {
          const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          tipParts.push(`${LC_MOOD_EMOJIS[i]} ${counts[i]} (${pct}%)`);
        }
        const barTitle = tipParts.join('  ');
        html += `<div class="lc-mood-stacked-bar-wrap" title="${barTitle}">`;
        for (let i = 0; i < 5; i++) {
          if (counts[i] > 0) {
            const pct = (counts[i] / total) * 100;
            html += `<div class="lc-mood-stacked-seg" data-mood="${i + 1}" style="width:${pct}%"></div>`;
          }
        }
        html += `</div>`;
      }
      html += `</div>`;
    });

    html += `<div class="lc-mood-legend">`;
    for (let i = 0; i < 5; i++) {
      html += `<span class="lc-mood-legend-item"><span class="lc-mood-legend-dot" data-mood="${i + 1}"></span>${LC_MOOD_EMOJIS[i]}</span>`;
    }
    html += `</div>`;
    html += `<div class="lc-mood-score-desc">${t('lcScoreDesc')}</div>`;

    container.innerHTML = html;

    container.querySelectorAll('.lc-mood-today-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mood = parseInt(btn.dataset.mood);
        lifeCounterData.moods[getTodayKey()] = mood;
        saveLifeCounterData();
        updateMoodBar();
        renderStatsContent();
      });
    });
  }

  function getMoodColor(val) {
    const colors = [
      [220, 85, 85],
      [225, 160, 75],
      [210, 210, 100],
      [100, 200, 100],
      [70, 170, 230]
    ];
    if (val <= 1) return `rgb(${colors[0].join(',')})`;
    if (val >= 5) return `rgb(${colors[4].join(',')})`;
    const idx = val - 1;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, 4);
    const t = idx - lo;
    const r = Math.round(colors[lo][0] + (colors[hi][0] - colors[lo][0]) * t);
    const g = Math.round(colors[lo][1] + (colors[hi][1] - colors[lo][1]) * t);
    const b = Math.round(colors[lo][2] + (colors[hi][2] - colors[lo][2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  function filterMoodsByPeriod(period) {
    const moods = lifeCounterData.moods || {};
    const now = new Date();
    const entries = Object.entries(moods);

    if (period === 'life') {
      return entries.map(e => e[1]);
    }

    return entries.filter(([dateStr]) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (period === 'week') {
        const entryDate = new Date(y, m - 1, d);
        const diff = now - entryDate;
        return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
      }
      if (period === 'month') {
        return y === now.getFullYear() && m === (now.getMonth() + 1);
      }
      if (period === 'quarter') {
        if (y !== now.getFullYear()) return false;
        const currentQ = Math.floor(now.getMonth() / 3);
        const entryQ = Math.floor((m - 1) / 3);
        return currentQ === entryQ;
      }
      if (period === 'year') {
        return y === now.getFullYear();
      }
      return true;
    }).map(e => e[1]);
  }

  // --- Close panels on outside click ---
  document.addEventListener('click', (e) => {
    if (settingsPanel && settingsPanel.classList.contains('open')) {
      const clickedSettingsBtn = settingsBtn && settingsBtn.contains(e.target);
      const clickedMementoBtn = settingsBtnMemento && settingsBtnMemento.contains(e.target);
      const clickedPanel = settingsPanel.contains(e.target);

      if (!clickedPanel && !clickedSettingsBtn && !clickedMementoBtn) {
        closeSettingsPanel();
      }
    }
    if (statsPanel && statsPanel.classList.contains('open')) {
      const clickedStatsBtn = statsBtn && statsBtn.contains(e.target);
      const clickedPanel = statsPanel.contains(e.target);

      if (!clickedPanel && !clickedStatsBtn) {
        closeStatsPanel();
      }
    }
  });

  // --- Utilities ---
  function saveLifeCounterData() {
    chrome.storage.local.set({ [LIFE_COUNTER_STORAGE_KEY]: lifeCounterData });
  }

  function renderProgressbar() {
    const progress = document.getElementById('lifeCounterProgress');
    if (!progress || !lifeCounterData.birthdate) return;

    const calc = calculateLifeProgress(lifeCounterData.birthdate, lifeCounterData.expectancy);
    progress.style.width = calc.percentage + '%';

    if (percentageDisplay) {
      percentageDisplay.textContent = Math.round(calc.percentage) + '%';
    }
  }

  function calculateLifeProgress(birthdate, expectancy) {
    const birth = new Date(birthdate);
    const now = new Date();
    const ageMs = now - birth;
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    const monthsLived = Math.floor(ageYears * 12);
    const totalMonths = expectancy * 12;
    const percentage = Math.min((monthsLived / totalMonths) * 100, 100);

    return { monthsLived, totalMonths, percentage, ageYears };
  }

  function handleProgressbarHover() {
    const tooltipEl = document.getElementById('lifeCounterTooltip');
    if (!lifeCounterData.birthdate || !tooltipEl) return;

    const calc = calculateLifeProgress(lifeCounterData.birthdate, lifeCounterData.expectancy);
    const monthsLeft = Math.max(0, calc.totalMonths - calc.monthsLived);

    const mo = t('lcMonthsShort');
    tooltipEl.innerHTML = `<span class="lc-stat-value-lived">${calc.monthsLived}</span><span style="opacity:0.4">/</span><span class="lc-stat-value-left">${monthsLeft}</span> <span style="opacity:0.4">${mo}</span>`;
    tooltipEl.style.opacity = '1';
  }

  function toggleSettingsPanel() {
    if (!settingsPanel) return;
    if (settingsPanel.classList.contains('open')) {
      closeSettingsPanel();
    } else {
      openSettingsPanel_();
    }
  }

  function openSettingsPanel_() {
    if (!settingsPanel) return;
    closeStatsPanel();

    if (birthdateInput) birthdateInput.value = lifeCounterData.birthdate || '';
    if (expectancyInput) expectancyInput.value = lifeCounterData.expectancy;
    if (expectancyValue) expectancyValue.textContent = lifeCounterData.expectancy;

    if (!lifeCounter) return;
    const rect = lifeCounter.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    settingsPanel.classList.remove('position-above', 'position-below');
    if (spaceAbove > spaceBelow && spaceAbove > 320) {
      settingsPanel.classList.add('position-above');
    } else {
      settingsPanel.classList.add('position-below');
    }

    settingsPanel.classList.add('open');
  }

  function closeSettingsPanel() {
    if (!settingsPanel) return;
    settingsPanel.classList.remove('open');
  }
}
