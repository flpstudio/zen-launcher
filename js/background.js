// ============ Zen Pulse Feature ============

let zenPulseEnabled = false;
let zenPulseRunning = false;

function initZenPulse() {
  // Load setting (default to true for new users)
  chrome.storage.local.get('zenPulseEnabled', (result) => {
    zenPulseEnabled = result.zenPulseEnabled !== undefined ? result.zenPulseEnabled : true;
    const toggle = document.getElementById('zenPulseToggle');
    if (toggle) {
      toggle.checked = zenPulseEnabled;
      toggle.addEventListener('change', () => {
        zenPulseEnabled = toggle.checked;
        chrome.storage.local.set({ zenPulseEnabled });
        // Demo pulse when enabling
        if (zenPulseEnabled) {
          stopZenPulse();
          startZenPulsePattern();
        }
      });
    }
    // Set default value if this is first time
    if (result.zenPulseEnabled === undefined) {
      chrome.storage.local.set({ zenPulseEnabled: true });
    }
  });
}

// ============ Grayscale Idle Feature ============

function initGrayscaleIdle() {
  chrome.storage.local.get('widgetGrayscale', (result) => {
    const enabled = result.widgetGrayscale !== undefined ? result.widgetGrayscale : false;
    document.body.classList.toggle('grayscale-idle', enabled);
    const toggle = document.getElementById('widgetGrayscaleToggle');
    if (toggle) {
      toggle.checked = enabled;
      toggle.addEventListener('change', () => {
        const on = toggle.checked;
        document.body.classList.toggle('grayscale-idle', on);
        chrome.storage.local.set({ widgetGrayscale: on });
      });
    }
    // Set default value if first time
    if (result.widgetGrayscale === undefined) {
      chrome.storage.local.set({ widgetGrayscale: false });
    }
  });
}

let zenPulseInterval = null;
let zenPulseTimeout = null;

// Get pulse origin: last minute digit, shifted toward center-bottom
function getZenPulseOrigin() {
  const clock = document.getElementById('clock');
  if (!clock) return null;
  const rect = clock.getBoundingClientRect();
  // Last minute digit is at the right end of the clock text
  // Approximate: ~90% across the clock width, vertically at ~65% (lower half center)
  const x = rect.left + rect.width * 0.9;
  const y = rect.top + rect.height * 0.65;
  return { x, y };
}

// Generic function to start zen pulse pattern (no setting check)
function startZenPulsePattern() {
  const origin = getZenPulseOrigin();
  if (!origin) return;
  
  // Don't start if already running
  if (zenPulseRunning) return;
  
  // Mark as running
  zenPulseRunning = true;
  
  // Emit first ripple immediately (no delay)
  createZenPulse(origin.x, origin.y);
  
  // Continue emitting ripples every 0.8 seconds
  zenPulseInterval = setInterval(() => {
    const o = getZenPulseOrigin();
    if (o) createZenPulse(o.x, o.y);
  }, 800);
  
  // Stop after 7 seconds
  zenPulseTimeout = setTimeout(() => {
    clearInterval(zenPulseInterval);
    zenPulseInterval = null;
    zenPulseTimeout = null;
    zenPulseRunning = false;
  }, 7000);
}

// Automatic trigger (checks setting and onboarding)
function emitZenPulseFromClock() {
  if (!zenPulseEnabled) return;
  
  // Only trigger if onboarding is done
  chrome.storage.local.get('onboardingDone', (data) => {
    if (data.onboardingDone) {
      startZenPulsePattern();
    }
  });
}

function stopZenPulse() {
  if (zenPulseInterval) {
    clearInterval(zenPulseInterval);
    zenPulseInterval = null;
  }
  if (zenPulseTimeout) {
    clearTimeout(zenPulseTimeout);
    zenPulseTimeout = null;
  }
  
  // Reset running flag
  zenPulseRunning = false;
  
  // Remove all existing zen pulse elements
  const ripples = document.querySelectorAll('.zen-pulse');
  ripples.forEach(ripple => ripple.remove());
}

// ============ Background Image Functions ============

const STORAGE_KEYS = {
  IMAGE_DATA: 'backgroundImageData',
  IMAGE_DATE: 'backgroundImageDate',
  GMAIL_TOKEN: 'gmailAccessToken'
};

// Get today's date as a string (YYYY-MM-DD)
function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}`;
}

// Generate a seed from date for consistent daily image
function getDateSeed() {
  const today = getTodayDateString();
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    const char = today.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Fetch image and convert to base64 for caching
async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Get cached image data from storage
async function getCachedImage() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.IMAGE_DATA, STORAGE_KEYS.IMAGE_DATE], (result) => {
      resolve({
        imageData: result[STORAGE_KEYS.IMAGE_DATA] || null,
        imageDate: result[STORAGE_KEYS.IMAGE_DATE] || null
      });
    });
  });
}

// Save image data to storage
async function cacheImage(imageData, dateString, updateRotationTime = false) {
  return new Promise((resolve) => {
    const data = {
      [STORAGE_KEYS.IMAGE_DATA]: imageData,
      [STORAGE_KEYS.IMAGE_DATE]: dateString
    };
    if (updateRotationTime) {
      data.bgLastRotated = Date.now();
    }
    chrome.storage.local.set(data, resolve);
  });
}

// Apply background image to the page
function applyBackgroundImage(imageData) {
  const bgElement = document.getElementById('backgroundImage');
  bgElement.style.backgroundImage = `url(${imageData})`;
  bgElement.classList.add('loaded');
}

// Fetch a new daily image from Picsum
async function fetchDailyImage() {
  const seed = getDateSeed();
  // Using Picsum with seed for consistent daily image
  // 1920x1080 for good quality desktop backgrounds
  const imageUrl = `https://picsum.photos/seed/${seed}/1920/1080`;
  
  try {
    const imageData = await fetchImageAsBase64(imageUrl);
    return imageData;
  } catch (error) {
    console.error('Failed to fetch daily image:', error);
    return null;
  }
}

// Apply a solid background color (instead of image)
function applyBackgroundColor(color) {
  const bgElement = document.getElementById('backgroundImage');
  bgElement.style.backgroundImage = 'none';
  bgElement.style.backgroundColor = color;
  bgElement.classList.add('loaded');
}

// Main function to load background image
async function loadBackgroundImage(forceImage) {
  // Check if user selected a solid color background
  if (!forceImage) {
    const bgType = await new Promise(resolve => {
      chrome.storage.local.get('bgType', r => resolve(r.bgType || 'image'));
    });
    if (bgType !== 'image') {
      applyBackgroundColor(bgType);
      return;
    }
  }

  const bgElement = document.getElementById('backgroundImage');
  bgElement.style.backgroundColor = '';

  const today = getTodayDateString();
  const cached = await getCachedImage();
  
  // Check if we have a cached image from today
  if (cached.imageData && cached.imageDate === today) {
    // Use cached image
    applyBackgroundImage(cached.imageData);
    return;
  }
  
  // If we have an old cached image, show it while fetching new one
  if (cached.imageData) {
    applyBackgroundImage(cached.imageData);
  }
  
  // Fetch new image
  const newImageData = await fetchDailyImage();
  
  if (newImageData) {
    await cacheImage(newImageData, today);
    applyBackgroundImage(newImageData);
  }
}

// Fetch a random new background image
async function fetchRandomBackgroundImage() {
  const btn = document.getElementById('bgRefreshBtn');
  btn.classList.add('loading');
  
  try {
    // Use random seed for a different image each time
    const randomSeed = Date.now();
    const imageUrl = `https://picsum.photos/seed/${randomSeed}/1920/1080`;
    
    const imageData = await fetchImageAsBase64(imageUrl);
    
    if (imageData) {
      const today = getTodayDateString();
      await cacheImage(imageData, today, true); // Update rotation timestamp
      applyBackgroundImage(imageData);
      
      // Also refresh the quote when background rotates
      if (typeof refreshQuote === 'function') {
        refreshQuote();
      }
    }
  } catch (error) {
    console.error('Failed to fetch random image:', error);
  } finally {
    btn.classList.remove('loading');
  }
}

// Initialize background controls
let bgRotationInterval = null;

function initBackgroundRefresh() {
  // Refresh button
  document.getElementById('bgRefreshBtn').addEventListener('click', fetchRandomBackgroundImage);
  
  // Settings button — opens modal
  const settingsBtn = document.getElementById('bgSettingsBtn');
  settingsBtn.addEventListener('click', () => {
    openSettingsModal();
  });
  
  // Dim slider
  const dimSlider = document.getElementById('bgDimSlider');
  const dimValue = document.getElementById('bgDimValue');
  
  // Blur slider
  const blurSlider = document.getElementById('bgBlurSlider');
  const blurValue = document.getElementById('bgBlurValue');
  
  // Rotation slider
  const ROTATE_STEPS = [0, 300000, 3600000, 86400000];
  const ROTATE_LABELS = [t('rotateNever'), t('rotate5min'), t('rotate1hour'), t('rotate1day')];
  const rotateSlider = document.getElementById('bgRotateSlider');
  const rotateValue = document.getElementById('bgRotateValue');
  
  // ---- Widget sliders ----
  const widgetOpacitySlider = document.getElementById('widgetOpacitySlider');
  const widgetOpacityValue = document.getElementById('widgetOpacityValue');
  const widgetBlurSlider = document.getElementById('widgetBlurSlider');
  const widgetBlurValue = document.getElementById('widgetBlurValue');

  // ---- Mood presets ----
  const MOOD_PRESETS = {
    clear:     { dim: 15, blur: 0,  widgetOpacity: 20, widgetBlur: 5,  grayscale: false },
    cozy:      { dim: 45, blur: 6,  widgetOpacity: 30, widgetBlur: 5,  grayscale: false },
    focus:     { dim: 65, blur: 12, widgetOpacity: 25, widgetBlur: 0,  grayscale: true },
    cinematic: { dim: 70, blur: 0,  widgetOpacity: 35, widgetBlur: 10, grayscale: true },
  };

  function detectMoodPreset(dim, blur, wOpacity, wBlur, grayscale) {
    for (const [name, preset] of Object.entries(MOOD_PRESETS)) {
      if (preset.dim === dim && preset.blur === blur &&
          preset.widgetOpacity === wOpacity && preset.widgetBlur === wBlur &&
          preset.grayscale === grayscale) return name;
    }
    return 'moodCustom';
  }

  function selectMoodRadio(name) {
    const radio = document.querySelector(`input[name="moodPreset"][value="${name}"]`);
    if (radio) radio.checked = true;
  }

  // ---- Background type grid ----
  const bgRefreshBtn = document.getElementById('bgRefreshBtn');
  const bgTypeGrid = document.querySelectorAll('.bg-type-option');
  const bgCustomPickerPanel = document.getElementById('bgCustomPicker');
  const bgCustomPickerClose = document.getElementById('bgCustomPickerClose');
  const bgCustomCanvas = document.getElementById('bgCustomCanvas');
  const blurSetting = blurSlider.closest('.bg-setting');
  const customSwatch = document.querySelector('.bg-type-custom-swatch');
  const customLabel = document.querySelector('.bg-type-custom-label');
  let savedCustomColor = '#3a3a4a';

  function updateCustomSlot(color) {
    savedCustomColor = color;
    if (customSwatch) customSwatch.style.background = color;
    if (customLabel) customLabel.textContent = color.toUpperCase();
    chrome.storage.local.set({ bgCustomColor: color });
  }

  bgCustomPickerClose.addEventListener('click', () => {
    bgCustomPickerPanel.style.display = 'none';
  });

  // Build spectrum canvas
  function drawSpectrumCanvas() {
    const ctx = bgCustomCanvas.getContext('2d');
    const w = bgCustomCanvas.width;
    const h = bgCustomCanvas.height;
    // Horizontal hue gradient
    const hueGrad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 360; i += 30) {
      hueGrad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, w, h);
    // Vertical white-to-transparent-to-black
    const lightGrad = ctx.createLinearGradient(0, 0, 0, h);
    lightGrad.addColorStop(0, 'rgba(255,255,255,1)');
    lightGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    lightGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    lightGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);
  }
  drawSpectrumCanvas();

  function getCanvasColor(e) {
    const rect = bgCustomCanvas.getBoundingClientRect();
    const scaleX = bgCustomCanvas.width / rect.width;
    const scaleY = bgCustomCanvas.height / rect.height;
    const x = Math.max(0, Math.min(bgCustomCanvas.width - 1, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(bgCustomCanvas.height - 1, (e.clientY - rect.top) * scaleY));
    const ctx = bgCustomCanvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return `#${pixel[0].toString(16).padStart(2,'0')}${pixel[1].toString(16).padStart(2,'0')}${pixel[2].toString(16).padStart(2,'0')}`;
  }

  let canvasDragging = false;
  bgCustomCanvas.addEventListener('mousedown', (e) => {
    canvasDragging = true;
    const color = getCanvasColor(e);
    updateCustomSlot(color);
    applyBgType(color);
  });
  bgCustomCanvas.addEventListener('mousemove', (e) => {
    if (!canvasDragging) return;
    const color = getCanvasColor(e);
    updateCustomSlot(color);
    applyBgType(color);
  });
  document.addEventListener('mouseup', () => { canvasDragging = false; });

  function selectBgTypeOption(bgType) {
    bgTypeGrid.forEach(opt => opt.classList.remove('active'));
    if (bgType === 'image') {
      const imgOpt = document.querySelector('.bg-type-option[data-bg="image"]');
      if (imgOpt) imgOpt.classList.add('active');
    } else {
      const match = document.querySelector(`.bg-type-option[data-bg="${bgType}"]`);
      if (match) {
        match.classList.add('active');
      } else {
        // Custom color
        const customOpt = document.querySelector('.bg-type-option[data-bg="custom"]');
        if (customOpt) customOpt.classList.add('active');
        updateCustomSlot(bgType);
      }
    }
  }

  function applyBgType(bgType) {
    chrome.storage.local.set({ bgType });
    if (bgType === 'image') {
      bgRefreshBtn.style.display = '';
      rotateSlider.closest('.bg-setting').classList.remove('disabled');
      blurSetting.classList.remove('disabled');
      bgCustomPickerPanel.style.display = 'none';
      loadBackgroundImage(true);
      const step = parseInt(rotateSlider.value);
      startBackgroundRotation(ROTATE_STEPS[step]);
    } else {
      bgRefreshBtn.style.display = 'none';
      rotateSlider.closest('.bg-setting').classList.add('disabled');
      blurSetting.classList.add('disabled');
      applyBackgroundColor(bgType);
      startBackgroundRotation(0);
    }
    selectBgTypeOption(bgType);
  }

  bgTypeGrid.forEach(opt => {
    opt.addEventListener('click', (e) => {
      const bg = opt.dataset.bg;
      if (bg === 'custom') {
        const isActive = opt.classList.contains('active');
        if (!isActive) {
          // First click: apply saved custom color
          bgCustomPickerPanel.style.display = 'none';
          applyBgType(savedCustomColor);
          updateCustomSlot(savedCustomColor);
        } else {
          // Second click: toggle the picker
          const isOpen = bgCustomPickerPanel.style.display !== 'none';
          bgCustomPickerPanel.style.display = isOpen ? 'none' : '';
          if (!isOpen) drawSpectrumCanvas();
        }
        return;
      }
      bgCustomPickerPanel.style.display = 'none';
      if (bg === 'image' && opt.classList.contains('active')) {
        // Already on image — rotate to a new one
        fetchRandomBackgroundImage();
        return;
      }
      applyBgType(bg);
    });
  });

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['bgDim', 'bgBlur', 'bgRotateInterval', 'bgLastRotated', 'widgetOpacity', 'widgetBlur', 'bgType', 'bgCustomColor', 'widgetGrayscale'], (result) => {
      const dim = result.bgDim !== undefined ? result.bgDim : 50;
      const blur = result.bgBlur !== undefined ? result.bgBlur : 0;
      const wOpacity = result.widgetOpacity !== undefined ? result.widgetOpacity : 25;
      const wBlur = result.widgetBlur !== undefined ? result.widgetBlur : 0;
      const rotateInterval = result.bgRotateInterval !== undefined ? result.bgRotateInterval : 86400000;
      const lastRotated = result.bgLastRotated || 0;
      const bgType = result.bgType || 'image';
      const grayscale = result.widgetGrayscale === true;

      // Restore saved custom color
      if (result.bgCustomColor) {
        savedCustomColor = result.bgCustomColor;
        if (customSwatch) customSwatch.style.background = savedCustomColor;
        if (customLabel) customLabel.textContent = savedCustomColor.toUpperCase();
      }
      
      dimSlider.value = dim;
      dimValue.textContent = `${dim}%`;
      
      blurSlider.value = blur;
      blurValue.textContent = `${blur}px`;

      widgetOpacitySlider.value = wOpacity;
      widgetOpacityValue.textContent = `${wOpacity}%`;
      widgetBlurSlider.value = wBlur;
      widgetBlurValue.textContent = `${wBlur}px`;
      
      const rotateStep = ROTATE_STEPS.indexOf(rotateInterval);
      rotateSlider.value = rotateStep >= 0 ? rotateStep : 0;
      rotateValue.textContent = ROTATE_LABELS[rotateSlider.value];
      
      applyBackgroundEffects(dim, blur);
      applyWidgetEffects(wOpacity, wBlur);
      selectMoodRadio(detectMoodPreset(dim, blur, wOpacity, wBlur, grayscale));

      // Apply background type
      selectBgTypeOption(bgType);
      if (bgType !== 'image') {
        bgRefreshBtn.style.display = 'none';
        rotateSlider.closest('.bg-setting').classList.add('disabled');
        blurSetting.classList.add('disabled');
        startBackgroundRotation(0);
      } else {
        startBackgroundRotation(rotateInterval);
        // Check if rotation is due
        if (rotateInterval > 0) {
          if (lastRotated > 0) {
            const elapsed = Date.now() - lastRotated;
            if (elapsed >= rotateInterval) {
              fetchRandomBackgroundImage();
            }
          } else {
            chrome.storage.local.set({ bgLastRotated: Date.now() });
          }
        }
      }
    });
  }

  // Mood preset change
  document.querySelectorAll('input[name="moodPreset"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const preset = MOOD_PRESETS[radio.value];
      if (!preset) return; // "custom" selected — no changes
      dimSlider.value = preset.dim;
      dimValue.textContent = `${preset.dim}%`;
      blurSlider.value = preset.blur;
      blurValue.textContent = `${preset.blur}px`;
      widgetOpacitySlider.value = preset.widgetOpacity;
      widgetOpacityValue.textContent = `${preset.widgetOpacity}%`;
      widgetBlurSlider.value = preset.widgetBlur;
      widgetBlurValue.textContent = `${preset.widgetBlur}px`;
      // Apply grayscale from preset
      const gsToggle = document.getElementById('widgetGrayscaleToggle');
      if (gsToggle) {
        gsToggle.checked = preset.grayscale;
        document.body.classList.toggle('grayscale-idle', preset.grayscale);
        chrome.storage.local.set({ widgetGrayscale: preset.grayscale });
      }
      applyBackgroundEffects(preset.dim, preset.blur);
      applyWidgetEffects(preset.widgetOpacity, preset.widgetBlur);
      saveBackgroundSettings();
    });
  });

  function currentMoodValues() {
    const gsToggle = document.getElementById('widgetGrayscaleToggle');
    return [parseInt(dimSlider.value), parseInt(blurSlider.value),
            parseInt(widgetOpacitySlider.value), parseInt(widgetBlurSlider.value),
            gsToggle ? gsToggle.checked : false];
  }

  // Dim slider change
  dimSlider.addEventListener('input', () => {
    const dim = parseInt(dimSlider.value);
    dimValue.textContent = `${dim}%`;
    applyBackgroundEffects(dim, parseInt(blurSlider.value));
    saveBackgroundSettings();
    selectMoodRadio(detectMoodPreset(...currentMoodValues()));
  });
  
  // Blur slider change
  blurSlider.addEventListener('input', () => {
    const blur = parseInt(blurSlider.value);
    blurValue.textContent = `${blur}px`;
    applyBackgroundEffects(parseInt(dimSlider.value), blur);
    saveBackgroundSettings();
    selectMoodRadio(detectMoodPreset(...currentMoodValues()));
  });

  // Widget opacity slider change
  widgetOpacitySlider.addEventListener('input', () => {
    const wOpacity = parseInt(widgetOpacitySlider.value);
    widgetOpacityValue.textContent = `${wOpacity}%`;
    applyWidgetEffects(wOpacity, parseInt(widgetBlurSlider.value));
    saveBackgroundSettings();
    selectMoodRadio(detectMoodPreset(...currentMoodValues()));
  });

  // Widget blur slider change
  widgetBlurSlider.addEventListener('input', () => {
    const wBlur = parseInt(widgetBlurSlider.value);
    widgetBlurValue.textContent = `${wBlur}px`;
    applyWidgetEffects(parseInt(widgetOpacitySlider.value), wBlur);
    saveBackgroundSettings();
    selectMoodRadio(detectMoodPreset(...currentMoodValues()));
  });

  // Grayscale toggle change — re-detect mood preset
  const gsToggle = document.getElementById('widgetGrayscaleToggle');
  if (gsToggle) {
    gsToggle.addEventListener('change', () => {
      selectMoodRadio(detectMoodPreset(...currentMoodValues()));
    });
  }

  // Rotation slider change
  rotateSlider.addEventListener('input', () => {
    const step = parseInt(rotateSlider.value);
    rotateValue.textContent = ROTATE_LABELS[step];
    const interval = ROTATE_STEPS[step];
    startBackgroundRotation(interval);
    saveBackgroundSettings();
  });
}

// Start or restart background rotation
function startBackgroundRotation(intervalMs) {
  // Clear existing interval
  if (bgRotationInterval) {
    clearInterval(bgRotationInterval);
    bgRotationInterval = null;
  }
  
  // Start new interval if > 0
  if (intervalMs > 0) {
    bgRotationInterval = setInterval(() => {
      fetchRandomBackgroundImage();
    }, intervalMs);
  }
}

// Apply background dim and blur effects
function applyBackgroundEffects(dim, blur) {
  const overlay = document.querySelector('.background-overlay');
  const bgImage = document.getElementById('backgroundImage');
  
  if (overlay) {
    overlay.style.background = `rgba(0, 0, 0, ${dim / 100})`;
  }
  
  if (bgImage) {
    bgImage.style.filter = blur > 0 ? `blur(${blur}px)` : 'none';
    // Always keep slight scale to avoid zoom jump when blur transitions from 0
    bgImage.style.transform = 'scale(1.05)';
  }
}

// Apply widget transparency and blur via CSS custom properties
function applyWidgetEffects(opacity, blur) {
  document.body.style.setProperty('--widget-bg-alpha', (opacity / 100).toFixed(2));
  document.body.style.setProperty('--widget-blur', blur > 0 ? blur + 'px' : '0px');
}

// Save background and widget settings
function saveBackgroundSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const dim = parseInt(document.getElementById('bgDimSlider').value);
    const blur = parseInt(document.getElementById('bgBlurSlider').value);
    const wOpacity = parseInt(document.getElementById('widgetOpacitySlider').value);
    const wBlur = parseInt(document.getElementById('widgetBlurSlider').value);
    const rotateStep = parseInt(document.getElementById('bgRotateSlider').value);
    const rotateSteps = [0, 300000, 3600000, 86400000];
    const rotateInterval = rotateSteps[rotateStep] || 0;
    chrome.storage.local.set({
      bgDim: dim, bgBlur: blur,
      widgetOpacity: wOpacity, widgetBlur: wBlur,
      bgRotateInterval: rotateInterval,
    });
  }
}

