// ============ Life Counter Widget ============

const LIFE_COUNTER_STORAGE_KEY = 'lifeCounterData';
let lifeCounterData = { birthdate: null, expectancy: 80 };

// Initialize Life Counter
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
  const tooltip = document.getElementById('lifeCounterTooltip');
  
  if (!lifeCounter) return;
  
  // Load data from storage
  chrome.storage.local.get([LIFE_COUNTER_STORAGE_KEY], (result) => {
    if (result[LIFE_COUNTER_STORAGE_KEY]) {
      lifeCounterData = result[LIFE_COUNTER_STORAGE_KEY];
    }
    
    // Show appropriate state
    updateDisplayState();
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
  
  // Handle settings button (memento state)
  if (settingsBtnMemento) {
    settingsBtnMemento.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
  }
  
  // Handle settings button (active state)
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    });
  }
  
  // Handle close button
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSettingsPanel();
    });
  }

  // Handle save/check button (settings auto-save, so just close)
  const saveBtn = document.getElementById('lifeCounterSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveLifeCounterData();
      updateDisplayState();
      closeSettingsPanel();
    });
  }
  
  // Handle birthday input change with auto-save
  if (birthdateInput) {
    birthdateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        lifeCounterData.birthdate = e.target.value;
        saveLifeCounterData();
        updateDisplayState();
      }
    });
  }
  
  // Update expectancy value display and auto-save
  if (expectancyInput && expectancyValue) {
    expectancyInput.addEventListener('input', () => {
      expectancyValue.textContent = expectancyInput.value;
      lifeCounterData.expectancy = parseInt(expectancyInput.value);
      saveLifeCounterData();
      renderProgressbar();
    });
  }
  
  // Handle progressbar hover
  if (progressBar) {
    progressBar.addEventListener('mousemove', handleProgressbarHover);
    progressBar.addEventListener('mouseleave', () => {
      const tooltipEl = document.getElementById('lifeCounterTooltip');
      if (tooltipEl) tooltipEl.style.opacity = '0';
    });
  }
  
  // Close settings panel on outside click
  document.addEventListener('click', (e) => {
    if (settingsPanel && settingsPanel.classList.contains('open')) {
      const clickedSettingsBtn = settingsBtn && settingsBtn.contains(e.target);
      const clickedMementoBtn = settingsBtnMemento && settingsBtnMemento.contains(e.target);
      const clickedPanel = settingsPanel.contains(e.target);
      
      if (!clickedPanel && !clickedSettingsBtn && !clickedMementoBtn) {
        closeSettingsPanel();
      }
    }
  });
  
  function saveLifeCounterData() {
    chrome.storage.local.set({ [LIFE_COUNTER_STORAGE_KEY]: lifeCounterData });
  }
  
  function renderProgressbar() {
    const progress = document.getElementById('lifeCounterProgress');
    if (!progress || !lifeCounterData.birthdate) return;
    
    const calc = calculateLifeProgress(lifeCounterData.birthdate, lifeCounterData.expectancy);
    progress.style.width = calc.percentage + '%';
    
    // Update percentage display (only 2 digits)
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
    
    return {
      monthsLived,
      totalMonths,
      percentage,
      ageYears
    };
  }
  
  function handleProgressbarHover(event) {
    const tooltipEl = document.getElementById('lifeCounterTooltip');
    if (!lifeCounterData.birthdate || !tooltipEl) return;
    
    const calc = calculateLifeProgress(lifeCounterData.birthdate, lifeCounterData.expectancy);
    const monthsLeft = calc.totalMonths - calc.monthsLived;
    
    tooltipEl.textContent = `${t('lifeCounterMonths')}: ${calc.monthsLived} ${t('lifeCounterLived')} / ${monthsLeft} ${t('lifeCounterLeft')}`;
    tooltipEl.style.opacity = '1';
  }
  
  function toggleSettingsPanel() {
    if (!settingsPanel) return;
    if (settingsPanel.classList.contains('open')) {
      closeSettingsPanel();
    } else {
      openSettingsPanel();
    }
  }
  
  function openSettingsPanel() {
    if (!settingsPanel) return;
    
    // Populate current values
    if (birthdateInput) birthdateInput.value = lifeCounterData.birthdate || '';
    if (expectancyInput) expectancyInput.value = lifeCounterData.expectancy;
    if (expectancyValue) expectancyValue.textContent = lifeCounterData.expectancy;
    
    // Determine position (above or below)
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

