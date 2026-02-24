// ============ Clock Functions ============

let _lastClockMinute = -1;

function padZero(num) {
  return num.toString().padStart(2, '0');
}

// Default world clock timezones
const DEFAULT_TIMEZONES = [
  { icon: '🇺🇸', name: 'NY', timezone: 'America/New_York' },
  { icon: '🇬🇧', name: 'GB', timezone: 'Europe/London' },
  { icon: '🇷🇺', name: 'RU', timezone: 'Europe/Moscow' },
  { icon: '🇯🇵', name: 'JP', timezone: 'Asia/Tokyo' }
];

// Common timezones for selection
const TIMEZONE_OPTIONS = [
  // GMT-12 to GMT-1
  { value: 'Etc/GMT+12', label: 'GMT-12:00 (Baker Island)' },
  { value: 'Etc/GMT+11', label: 'GMT-11:00 (American Samoa)' },
  { value: 'Pacific/Honolulu', label: 'GMT-10:00 (Hawaii)' },
  { value: 'Pacific/Marquesas', label: 'GMT-09:30 (Marquesas)' },
  { value: 'America/Anchorage', label: 'GMT-09:00 (Alaska)' },
  { value: 'America/Los_Angeles', label: 'GMT-08:00 (Los Angeles)' },
  { value: 'America/Vancouver', label: 'GMT-08:00 (Vancouver)' },
  { value: 'America/Denver', label: 'GMT-07:00 (Denver)' },
  { value: 'America/Phoenix', label: 'GMT-07:00 (Phoenix)' },
  { value: 'America/Chicago', label: 'GMT-06:00 (Chicago)' },
  { value: 'America/Mexico_City', label: 'GMT-06:00 (Mexico City)' },
  { value: 'America/New_York', label: 'GMT-05:00 (New York)' },
  { value: 'America/Toronto', label: 'GMT-05:00 (Toronto)' },
  { value: 'America/Bogota', label: 'GMT-05:00 (Bogota)' },
  { value: 'America/Lima', label: 'GMT-05:00 (Lima)' },
  { value: 'America/Caracas', label: 'GMT-04:00 (Caracas)' },
  { value: 'America/Santiago', label: 'GMT-04:00 (Santiago)' },
  { value: 'America/Halifax', label: 'GMT-04:00 (Halifax)' },
  { value: 'America/St_Johns', label: 'GMT-03:30 (Newfoundland)' },
  { value: 'America/Sao_Paulo', label: 'GMT-03:00 (São Paulo)' },
  { value: 'America/Buenos_Aires', label: 'GMT-03:00 (Buenos Aires)' },
  { value: 'Atlantic/South_Georgia', label: 'GMT-02:00 (South Georgia)' },
  { value: 'Atlantic/Azores', label: 'GMT-01:00 (Azores)' },
  { value: 'Atlantic/Cape_Verde', label: 'GMT-01:00 (Cape Verde)' },
  // GMT+0
  { value: 'Etc/GMT', label: 'GMT+00:00 (UTC)' },
  { value: 'Europe/London', label: 'GMT+00:00 (London)' },
  { value: 'Europe/Dublin', label: 'GMT+00:00 (Dublin)' },
  { value: 'Europe/Lisbon', label: 'GMT+00:00 (Lisbon)' },
  { value: 'Africa/Casablanca', label: 'GMT+00:00 (Casablanca)' },
  // GMT+1 to GMT+14
  { value: 'Europe/Paris', label: 'GMT+01:00 (Paris)' },
  { value: 'Europe/Berlin', label: 'GMT+01:00 (Berlin)' },
  { value: 'Europe/Amsterdam', label: 'GMT+01:00 (Amsterdam)' },
  { value: 'Europe/Brussels', label: 'GMT+01:00 (Brussels)' },
  { value: 'Europe/Madrid', label: 'GMT+01:00 (Madrid)' },
  { value: 'Europe/Rome', label: 'GMT+01:00 (Rome)' },
  { value: 'Europe/Warsaw', label: 'GMT+01:00 (Warsaw)' },
  { value: 'Africa/Lagos', label: 'GMT+01:00 (Lagos)' },
  { value: 'Europe/Athens', label: 'GMT+02:00 (Athens)' },
  { value: 'Europe/Bucharest', label: 'GMT+02:00 (Bucharest)' },
  { value: 'Europe/Helsinki', label: 'GMT+02:00 (Helsinki)' },
  { value: 'Europe/Kyiv', label: 'GMT+02:00 (Kyiv)' },
  { value: 'Africa/Cairo', label: 'GMT+02:00 (Cairo)' },
  { value: 'Africa/Johannesburg', label: 'GMT+02:00 (Johannesburg)' },
  { value: 'Asia/Jerusalem', label: 'GMT+02:00 (Jerusalem)' },
  { value: 'Europe/Istanbul', label: 'GMT+03:00 (Istanbul)' },
  { value: 'Europe/Moscow', label: 'GMT+03:00 (Moscow)' },
  { value: 'Asia/Baghdad', label: 'GMT+03:00 (Baghdad)' },
  { value: 'Asia/Riyadh', label: 'GMT+03:00 (Riyadh)' },
  { value: 'Africa/Nairobi', label: 'GMT+03:00 (Nairobi)' },
  { value: 'Asia/Tehran', label: 'GMT+03:30 (Tehran)' },
  { value: 'Asia/Dubai', label: 'GMT+04:00 (Dubai)' },
  { value: 'Asia/Baku', label: 'GMT+04:00 (Baku)' },
  { value: 'Indian/Mauritius', label: 'GMT+04:00 (Mauritius)' },
  { value: 'Asia/Kabul', label: 'GMT+04:30 (Kabul)' },
  { value: 'Asia/Karachi', label: 'GMT+05:00 (Karachi)' },
  { value: 'Asia/Tashkent', label: 'GMT+05:00 (Tashkent)' },
  { value: 'Asia/Kolkata', label: 'GMT+05:30 (Mumbai/Delhi)' },
  { value: 'Asia/Colombo', label: 'GMT+05:30 (Colombo)' },
  { value: 'Asia/Kathmandu', label: 'GMT+05:45 (Kathmandu)' },
  { value: 'Asia/Dhaka', label: 'GMT+06:00 (Dhaka)' },
  { value: 'Asia/Almaty', label: 'GMT+06:00 (Almaty)' },
  { value: 'Asia/Yangon', label: 'GMT+06:30 (Yangon)' },
  { value: 'Asia/Bangkok', label: 'GMT+07:00 (Bangkok)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'GMT+07:00 (Ho Chi Minh)' },
  { value: 'Asia/Jakarta', label: 'GMT+07:00 (Jakarta)' },
  { value: 'Asia/Shanghai', label: 'GMT+08:00 (Shanghai)' },
  { value: 'Asia/Hong_Kong', label: 'GMT+08:00 (Hong Kong)' },
  { value: 'Asia/Singapore', label: 'GMT+08:00 (Singapore)' },
  { value: 'Asia/Taipei', label: 'GMT+08:00 (Taipei)' },
  { value: 'Asia/Manila', label: 'GMT+08:00 (Manila)' },
  { value: 'Australia/Perth', label: 'GMT+08:00 (Perth)' },
  { value: 'Asia/Tokyo', label: 'GMT+09:00 (Tokyo)' },
  { value: 'Asia/Seoul', label: 'GMT+09:00 (Seoul)' },
  { value: 'Australia/Darwin', label: 'GMT+09:30 (Darwin)' },
  { value: 'Australia/Adelaide', label: 'GMT+09:30 (Adelaide)' },
  { value: 'Australia/Sydney', label: 'GMT+10:00 (Sydney)' },
  { value: 'Australia/Brisbane', label: 'GMT+10:00 (Brisbane)' },
  { value: 'Australia/Melbourne', label: 'GMT+10:00 (Melbourne)' },
  { value: 'Pacific/Guam', label: 'GMT+10:00 (Guam)' },
  { value: 'Pacific/Noumea', label: 'GMT+11:00 (Noumea)' },
  { value: 'Pacific/Guadalcanal', label: 'GMT+11:00 (Solomon Islands)' },
  { value: 'Pacific/Auckland', label: 'GMT+12:00 (Auckland)' },
  { value: 'Pacific/Fiji', label: 'GMT+12:00 (Fiji)' },
  { value: 'Pacific/Chatham', label: 'GMT+12:45 (Chatham Islands)' },
  { value: 'Pacific/Tongatapu', label: 'GMT+13:00 (Tonga)' },
  { value: 'Pacific/Apia', label: 'GMT+13:00 (Samoa)' },
  { value: 'Pacific/Kiritimati', label: 'GMT+14:00 (Line Islands)' }
];

// Current configured timezones
let configuredTimezones = [];

// Get saved timezones
async function getSavedTimezones() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(DEFAULT_TIMEZONES);
      return;
    }
    chrome.storage.local.get(['worldTimezones'], (result) => {
      resolve(result.worldTimezones || []);
    });
  });
}

// Save timezones
async function saveTimezones(timezones) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.set({ worldTimezones: timezones }, resolve);
  });
}

// Clock display settings
let clockFormat = '24h';
let clockShowSeconds = false;
let clockDateView = 'date';
let clockDateFormat = 'dd Month, yyyy';

// Focus mode state
let focusDuration = 10;
let focusHideWorkspace = true;
let focusActive = false;
let focusEndTime = null;
let focusInterval = null;
let focusSavedDim = null;

const focusChannel = new BroadcastChannel('zen-focus-sync');
const focusTabId = Math.random().toString(36).slice(2);

focusChannel.onmessage = (e) => {
  const d = e.data;
  if (!d) return;
  if (d.type === 'focus-start' && d.tabId !== focusTabId) {
    enterFocusUI(d.endTime);
  } else if (d.type === 'focus-stop' && d.tabId !== focusTabId) {
    exitFocusUI(d.completed);
  }
};

function startFocusMode() {
  if (focusActive) return;
  focusEndTime = Date.now() + focusDuration * 60 * 1000;
  chrome.storage.local.set({ focusEndTime });
  chrome.storage.local.remove('focusSoundClaimed');
  focusChannel.postMessage({ type: 'focus-start', tabId: focusTabId, endTime: focusEndTime });
  enterFocusUI(focusEndTime);
}

function enterFocusUI(endTime) {
  focusActive = true;
  focusEndTime = endTime;
  document.body.classList.add('focus-active');

  const wrapper = document.getElementById('mainClockWrapper');
  if (wrapper) wrapper.classList.remove('show-ampm', 'show-seconds');

  if (focusHideWorkspace) {
    document.body.classList.add('focus-mode');
    const dimSlider = document.getElementById('bgDimSlider');
    const blurSlider = document.getElementById('bgBlurSlider');
    if (dimSlider && blurSlider) {
      focusSavedDim = parseInt(dimSlider.value);
      applyBackgroundEffects(80, parseInt(blurSlider.value));
    }
  }

  if (typeof updateFavicon === 'function') updateFavicon();

  if (focusInterval) clearInterval(focusInterval);
  updateFocusTimer();
  focusInterval = setInterval(updateFocusTimer, 1000);
}

function stopFocusMode(playSound) {
  if (!focusActive) return;
  chrome.storage.local.remove('focusEndTime');
  focusChannel.postMessage({ type: 'focus-stop', tabId: focusTabId, completed: !!playSound });
  exitFocusUI(!!playSound);
  if (playSound) claimAndPlayFocusSound();
}

function claimAndPlayFocusSound() {
  const delay = Math.floor(Math.random() * 200);
  setTimeout(() => {
    chrome.storage.local.get('focusSoundClaimed', (data) => {
      if (data.focusSoundClaimed) return;
      chrome.storage.local.set({ focusSoundClaimed: focusTabId }, () => {
        setTimeout(() => {
          chrome.storage.local.get('focusSoundClaimed', (check) => {
            if (check.focusSoundClaimed === focusTabId) {
              playFocusCompleteSound();
              setTimeout(() => chrome.storage.local.remove('focusSoundClaimed'), 10000);
            }
          });
        }, 100);
      });
    });
  }, delay);
}

function exitFocusUI(completed) {
  focusActive = false;
  focusEndTime = null;
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }
  document.body.classList.remove('focus-mode');
  document.body.classList.remove('focus-active');

  if (focusSavedDim !== null) {
    const blurSlider = document.getElementById('bgBlurSlider');
    if (blurSlider) {
      applyBackgroundEffects(focusSavedDim, parseInt(blurSlider.value));
    }
    focusSavedDim = null;
  }

  if (typeof updateFavicon === 'function') updateFavicon();
  if (completed && typeof startZenPulsePattern === 'function') startZenPulsePattern();

  updateClock();
}

function updateFocusTimer() {
  const remaining = Math.max(0, focusEndTime - Date.now());
  if (remaining <= 0) {
    stopFocusMode(true);
    return;
  }
  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const clockEl = document.getElementById('clock');
  if (clockEl) clockEl.textContent = `${padZero(min)}:${padZero(sec)}`;
}

function resumeFocusIfActive() {
  chrome.storage.local.get('focusEndTime', (data) => {
    if (data.focusEndTime && data.focusEndTime > Date.now()) {
      enterFocusUI(data.focusEndTime);
    } else if (data.focusEndTime) {
      chrome.storage.local.remove('focusEndTime');
      claimAndPlayFocusSound();
      if (typeof startZenPulsePattern === 'function') startZenPulsePattern();
    }
  });
}

function playFocusCompleteSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(1, now + 2);
    master.gain.setValueAtTime(1, now + 3);
    master.gain.exponentialRampToValueAtTime(0.001, now + 9);
    master.connect(ctx.destination);

    const bowlFreqs = [261.6, 392.0, 523.3, 659.3, 784.0];
    bowlFreqs.forEach((freq, i) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq + 1.2 + i * 0.3;
      const vol = 0.028 / (i + 1);
      const g1 = ctx.createGain();
      const g2 = ctx.createGain();
      g1.gain.value = vol;
      g2.gain.value = vol;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.015;
      const lfoG = ctx.createGain();
      lfoG.gain.value = vol * 0.4;
      lfo.connect(lfoG);
      lfoG.connect(g1.gain);
      osc1.connect(g1);
      osc2.connect(g2);
      g1.connect(master);
      g2.connect(master);
      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
      osc1.stop(now + 10);
      osc2.stop(now + 10);
      lfo.stop(now + 10);
    });

    setTimeout(() => ctx.close(), 11000);
  } catch (e) {
    console.warn('[Focus] Could not play completion sound:', e);
  }
}

function getTimeInTimezone(timezone) {
  try {
    const now = new Date();
    const is12h = clockFormat === '12h';
    const options = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: is12h
    };
    return now.toLocaleTimeString(is12h ? 'en-US' : 'en-GB', options);
  } catch (e) {
    return '--:--';
  }
}

// Render world clocks
function renderWorldClocks() {
  const container = document.getElementById('worldClocks');
  if (!container) return;
  
  container.innerHTML = configuredTimezones.map((tz, index) => `
    <div class="world-clock" data-index="${index}">
      <span class="tz-icon">${tz.icon}</span>
      <span class="tz-name">${tz.name.slice(0, 10)}</span>
      <span class="tz-time" data-timezone="${tz.timezone}">--:--</span>
    </div>
  `).join('');
}

function updateClock() {
  if (focusActive) return;

  const now = new Date();
  const is12h = clockFormat === '12h';

  // Format time
  let h = now.getHours();
  let ampm = '';
  if (is12h) {
    ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  const hours = padZero(h);
  const minutes = padZero(now.getMinutes());
  const timeString = `${hours}:${minutes}`;

  // Format date as dd Month yyyy
  const day = padZero(now.getDate());
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const dateString = `${day} ${month} ${year}`;

  document.getElementById('clock').textContent = timeString;

  // AM/PM
  const ampmEl = document.getElementById('clockAmPm');
  if (ampmEl) ampmEl.textContent = ampm;

  // Seconds
  const seconds = now.getSeconds();
  const secEl = document.getElementById('clockSeconds');
  if (secEl) secEl.textContent = clockShowSeconds ? `:${padZero(seconds)}` : '';

  // Toggle wrapper classes
  const wrapper = document.getElementById('mainClockWrapper');
  if (wrapper) {
    wrapper.classList.toggle('show-ampm', is12h);
    wrapper.classList.toggle('show-seconds', clockShowSeconds);
  }

  // Update world clocks
  document.querySelectorAll('.tz-time[data-timezone]').forEach((el) => {
    el.textContent = getTimeInTimezone(el.dataset.timezone);
  });
  
  // Detect minute flip (never missed, even with interval drift)
  const currentMinute = now.getMinutes();
  if (_lastClockMinute !== -1 && currentMinute !== _lastClockMinute) {
    emitZenPulseFromClock();
    if (clockDateView === 'date') {
      const dateText = document.getElementById('clockDateText');
      if (dateText) dateText.textContent = formatClockDate(clockDateFormat);
    }
  }
  _lastClockMinute = currentMinute;
}

// ============ Calendar Functions ============

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function renderCalendarMonth(year, month, isCurrentMonth = false) {
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Convert Sunday=0 to Monday=0 format: (day + 6) % 7
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  
  let daysHtml = '';
  
  // Empty cells for days before the 1st
  for (let i = 0; i < startDayOfWeek; i++) {
    daysHtml += `<div class="calendar-day empty"></div>`;
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === todayDate && month === todayMonth && year === todayYear;
    const dayOfWeek = new Date(year, month, day).getDay();
    // Sunday = 0, Saturday = 6 in JS
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isWeekend) classes += ' weekend';
    
    daysHtml += `<div class="${classes}">${day}</div>`;
  }
  
  // Empty cells to fill the grid
  const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  const remainingCells = totalCells - (startDayOfWeek + daysInMonth);
  for (let i = 0; i < remainingCells; i++) {
    daysHtml += `<div class="calendar-day empty"></div>`;
  }
  
  const weekdaysHtml = weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
  
  return `
    <div class="calendar-month${isCurrentMonth ? ' current' : ''}">
      <div class="calendar-month-header">${getMonthName(month, true)}</div>
      <div class="calendar-weekdays">${weekdaysHtml}</div>
      <div class="calendar-days">${daysHtml}</div>
    </div>
  `;
}

function renderCalendar() {
  const container = document.getElementById('calendarMonths');
  if (!container) return;
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Previous month
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear--;
  }
  
  // Next month
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }
  
  container.innerHTML = 
    renderCalendarMonth(prevYear, prevMonth, false) +
    renderCalendarMonth(currentYear, currentMonth, true) +
    renderCalendarMonth(nextYear, nextMonth, false);
}

// ============ Meetings Functions ============

let meetingsUpdateInterval = null;

// Get auth token with calendar scope
async function getCalendarAuthToken(forceNew = false) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.identity) {
      console.error('chrome.identity not available for calendar');
      resolve(null);
      return;
    }
    
    const getToken = () => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Calendar auth error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(token);
      });
    };
    
    if (forceNew) {
      // First get the current token so we can remove it
      chrome.identity.getAuthToken({ interactive: false }, (oldToken) => {
        if (oldToken) {
          // Revoke it with Google
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${oldToken}`);
          // Remove from Chrome cache
          chrome.identity.removeCachedAuthToken({ token: oldToken }, () => {
            console.log('Old token removed, getting new one...');
            getToken();
          });
        } else {
          getToken();
        }
      });
    } else {
      getToken();
    }
  });
}

// Fetch upcoming meetings from Google Calendar
async function fetchMeetings() {
  try {
    const token = await getCalendarAuthToken();
    if (!token) {
      return [];
    }
    
    const now = new Date();
    
    // Get meetings for the next 7 days (expanded window)
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);
    
    const timeMin = now.toISOString();
    const timeMax = endDate.toISOString();
    
    console.log('Fetching calendar events from', timeMin, 'to', timeMax);
    console.log('Token available:', !!token);
    
    // First, let's get the list of calendars to debug
    try {
      const calListResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const calListData = await calListResponse.json();
      console.log('Available calendars:', calListData.items?.map(c => ({ id: c.id, summary: c.summary })));
    } catch (e) {
      console.error('Error fetching calendar list:', e);
    }
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&orderBy=startTime&maxResults=20&` +
      `conferenceDataVersion=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Calendar API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API error:', response.status, errorText);
      if (response.status === 401 || response.status === 403) {
        // Token expired or missing scope — show signed-out state
        console.log('Calendar auth failed, showing signed-out state');
        showSignedOutState();
      } else {
        showMeetingsError(t('failedLoadMeetings'));
      }
      return [];
    }
    
    const data = await response.json();
    console.log('Calendar events raw response:', data);
    console.log('Calendar events:', data.items?.length || 0, 'events found');
    if (data.items) {
      data.items.forEach((event, i) => {
        console.log(`Event ${i}:`, event.summary, event.start, event.end);
      });
    }
    return data.items || [];
  } catch (error) {
    console.error('Error fetching meetings:', error);
    showMeetingsError(t('failedLoadMeetings'));
    return [];
  }
}

// Format countdown string
function formatCountdown(diffMs) {
  if (diffMs < 0) return null; // Meeting has passed
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (diffHours > 0) {
    return `in ${diffHours}h ${mins}m`;
  } else if (diffMins > 0) {
    return `in ${diffMins}m`;
  } else {
    return 'now';
  }
}

// Get meeting link (Google Meet or event link)
function getMeetingLink(event) {
  // Check for Google Meet link
  if (event.hangoutLink) {
    return event.hangoutLink;
  }
  
  // Check for conference data (Google Meet, Zoom, etc.)
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(e => e.entryPointType === 'video');
    if (videoEntry) return videoEntry.uri;
  }
  
  // Check location for meeting URLs (Zoom, Teams, etc.)
  if (event.location) {
    const urlMatch = event.location.match(/https?:\/\/[^\s<>"]+?(zoom\.us|teams\.microsoft|meet\.google|webex)[^\s<>"]*/i);
    if (urlMatch) return urlMatch[0];
  }
  
  // Check description for meeting URLs
  if (event.description) {
    const urlMatch = event.description.match(/https?:\/\/[^\s<>"]+?(zoom\.us|teams\.microsoft|meet\.google|webex)[^\s<>"]*/i);
    if (urlMatch) return urlMatch[0];
  }
  
  // No direct call link found - return null (don't fall back to calendar event)
  return null;
}

// Render meetings
function renderMeetings(events) {
  const container = document.getElementById('meetingsSection');
  if (!container) return;
  
  // Store for re-rendering on language change
  lastMeetingsData = events;
  
  const now = new Date();
  
  // Filter and process meetings
  const meetings = events
    .filter(event => {
      // Skip all-day events
      if (event.start.date && !event.start.dateTime) return false;
      
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      
      // Include if meeting hasn't ended yet
      return endTime > now;
    })
    .slice(0, 3)
    .map(event => {
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const diffMs = startTime - now;
      
      let countdownText = '';
      let countdownClass = '';
      
      if (diffMs < 0 && now < endTime) {
        // Meeting is ongoing
        countdownText = 'now';
        countdownClass = 'now';
      } else if (diffMs >= 0) {
        countdownText = formatCountdown(diffMs);
        if (diffMs < 15 * 60000) { // Less than 15 minutes
          countdownClass = 'soon';
        } else if (diffMs < 3 * 60 * 60000) { // Less than 3 hours
          countdownClass = 'warning';
        }
      }
      
      // Build attendees string
      let attendeesStr = '';
      const people = [];
      
      // Add creator
      if (event.creator) {
        const creatorName = event.creator.displayName || event.creator.email?.split('@')[0] || '';
        if (creatorName) people.push(creatorName);
      }
      
      // Add attendees (excluding self and creator)
      if (event.attendees) {
        event.attendees.forEach(attendee => {
          if (attendee.self) return; // Skip self
          if (event.creator && attendee.email === event.creator.email) return; // Skip creator (already added)
          const name = attendee.displayName || attendee.email?.split('@')[0] || '';
          if (name && !people.includes(name)) people.push(name);
        });
      }
      
      if (people.length > 0) {
        attendeesStr = ' | ' + people.slice(0, 3).join(', ');
        if (people.length > 3) attendeesStr += '...';
      }
      
      return {
        title: (event.summary || t('noTitle')) + attendeesStr,
        time: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        countdown: countdownText,
        countdownClass: countdownClass,
        link: getMeetingLink(event)
      };
    });
  
  if (meetings.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = meetings.map((meeting, index) => `
    <div class="meeting-item${meeting.link ? ' has-link' : ''}" data-meeting-index="${index}">
      <span class="meeting-time">${meeting.time}</span>
      <div class="meeting-info">
        <div class="meeting-title">${escapeHtml(meeting.title)}</div>
      </div>
      ${meeting.countdown ? `<span class="meeting-countdown ${meeting.countdownClass}">${meeting.countdown}</span>` : ''}
      ${meeting.link ? `
        <span class="meeting-link" title="${t('joinMeeting')}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
        </span>
      ` : ''}
    </div>
  `).join('');
  
  // Add click handlers for meeting links
  container.querySelectorAll('.meeting-item.has-link').forEach((item, index) => {
    const meeting = meetings[index];
    if (meeting && meeting.link) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(meeting.link, '_blank');
      });
    }
  });
}

// Show meetings error
function showMeetingsError(message) {
  const container = document.getElementById('meetingsSection');
  if (container) {
    container.innerHTML = `<div class="meetings-error">${escapeHtml(message)}</div>`;
  }
}

// Load and update meetings (with stale-while-revalidate caching)
// forceRefresh: true = bypass cache
async function loadMeetings(forceRefresh = false) {
  // Show cached data immediately if available (and not force refresh)
  if (!forceRefresh && hasCachedData('meetings')) {
    renderMeetings(getCachedData('meetings'));
    
    // If cache is fresh, don't refetch
    if (isCacheFresh('meetings')) {
      return;
    }
    
    // Cache is stale, fetch in background
    fetchMeetings().then(events => {
      if (events && events.length >= 0) {
        setCacheData('meetings', events);
        renderMeetings(events);
      }
    }).catch(err => console.log('Background meetings refresh failed:', err));
    return;
  }
  
  // No cache or force refresh, fetch and wait
  const events = await fetchMeetings();
  setCacheData('meetings', events);
  renderMeetings(events);
}

// Initialize meetings
function initMeetings() {
  // Initial state - content will be loaded by initGmail if token exists
  const container = document.getElementById('meetingsSection');
  if (container) {
    container.innerHTML = '';
  }
  
  // Update every 30 seconds (silent background refresh)
  meetingsUpdateInterval = setInterval(async () => {
    // Only refresh if panel is in signed-in state
    const panel = document.getElementById('calendarPanel');
    if (panel && panel.classList.contains('not-signed-in')) return;
    try {
      const events = await fetchMeetings();
      if (events && events.length >= 0) {
        setCacheData('meetings', events);
        renderMeetings(events);
        console.log('Meetings auto-refreshed');
      }
    } catch (err) {
      console.log('Meetings auto-refresh failed:', err);
    }
  }, 30 * 1000);
}

// ============ Timezone Settings Modal ============

// Icon picker emojis - flags and location-related
const ICON_PICKER_EMOJIS = [
  // Flags
  '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹',
  '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇷🇺', '🇧🇷', '🇲🇽', '🇦🇷',
  '🇻🇳', '🇹🇭', '🇸🇬', '🇵🇭', '🇮🇩', '🇲🇾', '🇳🇿', '🇿🇦',
  '🇦🇪', '🇸🇦', '🇮🇱', '🇹🇷', '🇵🇱', '🇳🇱', '🇧🇪', '🇨🇭',
  // Landmarks & Places
  '🗼', '🗽', '🏰', '🕌', '⛩️', '🎡', '🌉', '🏛️',
  // Misc
  '🌍', '🌎', '🌏', '🏠', '🏢', '✈️', '🚀', '⭐',
  '☀️', '🌙', '⏰', '🕐', '🕑', '🕒', '🕓', '🕔'
];

let currentIconTarget = null;

// Removed openTimezoneModal and closeTimezoneModal - now using sliding panel

function openIconPicker(button, index) {
  const picker = document.getElementById('iconPicker');
  const grid = document.getElementById('iconPickerGrid');
  
  // Store target
  currentIconTarget = { button, index };
  
  // Render icons
  grid.innerHTML = ICON_PICKER_EMOJIS.map(emoji => `
    <button class="icon-picker-item" data-emoji="${emoji}">${emoji}</button>
  `).join('');
  
  // Add click handlers
  grid.querySelectorAll('.icon-picker-item').forEach(item => {
    item.addEventListener('click', () => {
      selectIcon(item.dataset.emoji);
    });
  });
  
  // Position picker near the button
  const rect = button.getBoundingClientRect();
  const pickerWidth = 280;
  const pickerHeight = 200;
  
  let left = rect.left;
  let top = rect.bottom + 5;
  
  // Ensure it stays in viewport
  if (left + pickerWidth > window.innerWidth - 10) {
    left = window.innerWidth - pickerWidth - 10;
  }
  if (top + pickerHeight > window.innerHeight - 10) {
    top = rect.top - pickerHeight - 5;
  }
  
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
  picker.classList.add('open');
}

function closeIconPicker() {
  const picker = document.getElementById('iconPicker');
  picker.classList.remove('open');
  currentIconTarget = null;
}

function selectIcon(emoji) {
  if (currentIconTarget) {
    currentIconTarget.button.textContent = emoji;
    currentIconTarget.button.dataset.icon = emoji;
  }
  closeIconPicker();
}

function renderTimezoneList() {
  const list = document.getElementById('tzList');
  list.innerHTML = configuredTimezones.map((tz, index) => `
    <div class="tz-item" data-index="${index}" draggable="true">
      <div class="tz-item-drag" title="${t('dragToReorder')}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </div>
      <div class="tz-item-fields">
        <div class="tz-item-row">
          <button type="button" class="tz-icon-btn" data-icon="${tz.icon}" data-index="${index}">${tz.icon}</button>
          <input type="text" class="tz-name-input" value="${tz.name}" maxlength="10" placeholder="${t('namePlaceholder')}">
        </div>
        <select class="tz-select">
          ${TIMEZONE_OPTIONS.map(opt => `
            <option value="${opt.value}" ${opt.value === tz.timezone ? 'selected' : ''}>${opt.label}</option>
          `).join('')}
        </select>
      </div>
      <button class="tz-item-remove" title="${t('removeLabel')}">&times;</button>
    </div>
  `).join('');
  
  // Add icon picker event listeners
  list.querySelectorAll('.tz-icon-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      openIconPicker(btn, index);
    });
  });
  
  // Add remove event listeners
  list.querySelectorAll('.tz-item-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(e.target.closest('.tz-item').dataset.index);
      configuredTimezones.splice(index, 1);
      renderTimezoneList();
    });
  });
  
  // Add drag-and-drop reordering
  initTimezoneDragReorder();
}

// Drag and drop reordering for timezones
function initTimezoneDragReorder() {
  const list = document.getElementById('tzList');
  const items = list.querySelectorAll('.tz-item');
  
  let draggedItem = null;
  let draggedIndex = null;
  
  items.forEach((item) => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      draggedIndex = parseInt(item.dataset.index);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedIndex);
    });
    
    item.addEventListener('dragend', () => {
      draggedItem.classList.remove('dragging');
      items.forEach(i => i.classList.remove('drag-over'));
      draggedItem = null;
      draggedIndex = null;
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (item !== draggedItem) {
        items.forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });
    
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      const targetIndex = parseInt(item.dataset.index);
      if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Save current values from DOM before reordering
        const currentItems = document.querySelectorAll('.tz-item');
        const updatedTimezones = Array.from(currentItems).map((itm) => ({
          icon: itm.querySelector('.tz-icon-btn').dataset.icon || '🌍',
          name: (itm.querySelector('.tz-name-input').value || 'Unknown').slice(0, 10),
          timezone: itm.querySelector('.tz-select').value
        }));
        
        // Reorder
        const [movedItem] = updatedTimezones.splice(draggedIndex, 1);
        updatedTimezones.splice(targetIndex, 0, movedItem);
        
        configuredTimezones = updatedTimezones;
        renderTimezoneList();
      }
    });
  });
}

function addTimezone() {
  // Save current input values before adding new timezone
  const items = document.querySelectorAll('.tz-item');
  configuredTimezones = Array.from(items).map((item) => ({
    icon: item.querySelector('.tz-icon-btn').dataset.icon || '🌍',
    name: (item.querySelector('.tz-name-input').value.trim() || 'Unknown').slice(0, 10),
    timezone: item.querySelector('.tz-select').value
  }));
  
  // Now add the new timezone
  configuredTimezones.push({
    icon: '🌍',
    name: 'New',
    timezone: 'Europe/London'
  });
  renderTimezoneList();
}

async function saveTimezoneSettings() {
  const items = document.querySelectorAll('.tz-item');
  configuredTimezones = Array.from(items).map((item) => ({
    icon: item.querySelector('.tz-icon-btn').dataset.icon || '🌍',
    name: (item.querySelector('.tz-name-input').value.trim() || 'Unknown').slice(0, 10),
    timezone: item.querySelector('.tz-select').value
  }));
  
  await saveTimezones(configuredTimezones);
  renderWorldClocks();
  updateClock();
}

// ============ Clock Settings (United Panel) ============

function initClockSettings() {
  const settingsBtn = document.getElementById('clockSettingsBtn');
  const panel = document.getElementById('clockSettingsPanel');
  const addBtn = document.getElementById('tzAddBtn');
  
  if (!settingsBtn || !panel) return;
  
  // Load saved clock display settings
  chrome.storage.local.get(['clockFormat', 'clockShowSeconds', 'clockDateView', 'clockDateFormat', 'focusDuration', 'focusHideWorkspace'], (result) => {
    if (result.clockFormat) clockFormat = result.clockFormat;
    if (result.clockShowSeconds !== undefined) clockShowSeconds = result.clockShowSeconds;
    if (result.clockDateView) clockDateView = result.clockDateView;
    if (result.clockDateFormat) clockDateFormat = result.clockDateFormat;
    if (result.focusDuration !== undefined) focusDuration = result.focusDuration;
    if (result.focusHideWorkspace !== undefined) focusHideWorkspace = result.focusHideWorkspace;
    applyClockSettingsUI();
    updateClock();
    updateClockDateArea();

    const focusSlider = document.getElementById('focusDurationSlider');
    const focusValue = document.getElementById('focusDurationValue');
    if (focusSlider) {
      focusSlider.value = focusDuration;
      if (focusValue) focusValue.textContent = focusDuration + 'm';
    }
    const hideWsToggle = document.getElementById('focusHideWorkspaceToggle');
    if (hideWsToggle) hideWsToggle.checked = focusHideWorkspace;
  });
  
  // Toggle panel on gear button click
  settingsBtn.addEventListener('click', () => {
    renderTimezoneList();
    
    // Determine if panel should open above or below based on available space
    const clockPanel = document.getElementById('clockPanel');
    if (clockPanel) {
      const rect = clockPanel.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // Position below if more space below, above if more space above
      if (spaceBelow > spaceAbove) {
        panel.classList.add('position-below');
        panel.classList.remove('position-above');
      } else {
        panel.classList.add('position-above');
        panel.classList.remove('position-below');
      }
    }
    
    panel.classList.toggle('open');
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (panel && panel.classList.contains('open')) {
      const iconPicker = document.getElementById('iconPicker');
      const clickedInPicker = iconPicker && iconPicker.contains(e.target);
      if (!panel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target) && !clickedInPicker) {
        // Auto-save before closing
        saveTimezoneSettings();
        panel.classList.remove('open');
        closeIconPicker();
      }
    }
  });
  
  // Close icon picker on click outside
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('iconPicker');
    if (picker && picker.classList.contains('open')) {
      if (!picker.contains(e.target) && !e.target.classList.contains('tz-icon-btn')) {
        closeIconPicker();
      }
    }
  });
  
  // Add timezone button
  if (addBtn) {
    addBtn.addEventListener('click', addTimezone);
  }

  // Save & close button
  const saveBtn = document.getElementById('clockSettingsSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveTimezoneSettings();
      panel.classList.remove('open');
      closeIconPicker();
    });
  }
  
  // 12h format toggle
  const fmtToggle = document.getElementById('clockFormatToggle');
  if (fmtToggle) {
    fmtToggle.addEventListener('change', () => {
      clockFormat = fmtToggle.checked ? '12h' : '24h';
      chrome.storage.local.set({ clockFormat });
      updateClock();
    });
  }

  // Seconds toggle
  const secToggle = document.getElementById('clockShowSecondsToggle');
  if (secToggle) {
    secToggle.addEventListener('change', () => {
      clockShowSeconds = secToggle.checked;
      chrome.storage.local.set({ clockShowSeconds });
      updateClock();
    });
  }

  // Calendar toggle
  const calToggle = document.getElementById('clockCalendarToggle');
  if (calToggle) {
    calToggle.addEventListener('change', () => {
      clockDateView = calToggle.checked ? 'calendar' : 'date';
      chrome.storage.local.set({ clockDateView });
      updateClockDateArea();
    });
  }

  // Date format select
  const dateFormatSelect = document.getElementById('clockDateFormatSelect');
  if (dateFormatSelect) {
    dateFormatSelect.addEventListener('change', () => {
      clockDateFormat = dateFormatSelect.value;
      chrome.storage.local.set({ clockDateFormat });
      updateClockDateArea();
    });
  }

  // Click on clock to toggle calendar/date view
  const clockWrapper = document.getElementById('mainClockWrapper');
  if (clockWrapper) {
    clockWrapper.addEventListener('click', (e) => {
      if (e.target.closest('.clock-settings-btn')) return;
      if (focusActive) return;
      clockDateView = clockDateView === 'calendar' ? 'date' : 'calendar';
      chrome.storage.local.set({ clockDateView });
      updateClockDateArea();
      applyClockSettingsUI();
    });
  }

  // Focus duration slider
  const focusSlider = document.getElementById('focusDurationSlider');
  const focusValue = document.getElementById('focusDurationValue');
  if (focusSlider) {
    focusSlider.addEventListener('input', () => {
      focusDuration = Number(focusSlider.value);
      if (focusValue) focusValue.textContent = focusDuration + 'm';
      chrome.storage.local.set({ focusDuration });
    });
  }

  // Focus hide workspace toggle
  const hideWsToggle = document.getElementById('focusHideWorkspaceToggle');
  if (hideWsToggle) {
    hideWsToggle.addEventListener('change', () => {
      focusHideWorkspace = hideWsToggle.checked;
      chrome.storage.local.set({ focusHideWorkspace });
    });
  }

  // Focus toggle button
  const focusBtn = document.getElementById('focusToggleBtn');
  if (focusBtn) {
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (focusActive) {
        stopFocusMode(false);
      } else {
        startFocusMode();
      }
    });
  }
}

function applyClockSettingsUI() {
  const fmtToggle = document.getElementById('clockFormatToggle');
  if (fmtToggle) fmtToggle.checked = clockFormat === '12h';
  const secToggle = document.getElementById('clockShowSecondsToggle');
  if (secToggle) secToggle.checked = clockShowSeconds;
  const calToggle = document.getElementById('clockCalendarToggle');
  if (calToggle) calToggle.checked = clockDateView === 'calendar';
  const dateFormatSelect = document.getElementById('clockDateFormatSelect');
  if (dateFormatSelect) dateFormatSelect.value = clockDateFormat;
}

// ============ Clock Date Area ============

function formatClockDate(format) {
  const now = new Date();
  const day = padZero(now.getDate());
  const monthIndex = now.getMonth();
  const monthName = getMonthName(monthIndex);
  const year = now.getFullYear();
  const mm = padZero(monthIndex + 1);
  const dd = padZero(now.getDate());

  switch (format) {
    case 'Month dd, yyyy':
      return `${monthName} ${now.getDate()}, ${year}`;
    case 'dd/mm/yyyy':
      return `${dd}/${mm}/${year}`;
    case 'mm/dd/yyyy':
      return `${mm}/${dd}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${mm}-${dd}`;
    case 'dd Month, yyyy':
    default:
      return `${now.getDate()} ${monthName}, ${year}`;
  }
}

function updateClockDateArea() {
  const area = document.getElementById('clockDateArea');
  if (!area) return;

  if (clockDateView === 'calendar') {
    area.classList.add('view-calendar');
    area.classList.remove('view-date');
    renderClockCalendar();
  } else {
    area.classList.add('view-date');
    area.classList.remove('view-calendar');
    const dateText = document.getElementById('clockDateText');
    if (dateText) {
      dateText.textContent = formatClockDate(clockDateFormat);
    }
  }
}

function renderClockCalendar() {
  const container = document.getElementById('clockCalendar');
  if (!container) return;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear--;
  }

  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear++;
  }

  container.innerHTML =
    renderCalendarMonth(prevYear, prevMonth, false) +
    renderCalendarMonth(currentYear, currentMonth, true) +
    renderCalendarMonth(nextYear, nextMonth, false);
}
