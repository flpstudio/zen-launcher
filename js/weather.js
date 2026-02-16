// ============ Weather Functions ============

let weatherUpdateInterval = null;
let weatherUnits = 'celsius'; // 'celsius' or 'fahrenheit'

// Weather condition codes to icons (WMO codes)
const weatherIcons = {
  0: '☀️',   // Clear sky
  1: '🌤️',   // Mainly clear
  2: '⛅',   // Partly cloudy
  3: '☁️',   // Overcast
  45: '🌫️',  // Fog
  48: '🌫️',  // Depositing rime fog
  51: '🌧️',  // Light drizzle
  53: '🌧️',  // Moderate drizzle
  55: '🌧️',  // Dense drizzle
  61: '🌧️',  // Slight rain
  63: '🌧️',  // Moderate rain
  65: '🌧️',  // Heavy rain
  71: '🌨️',  // Slight snow
  73: '🌨️',  // Moderate snow
  75: '🌨️',  // Heavy snow
  77: '🌨️',  // Snow grains
  80: '🌦️',  // Slight rain showers
  81: '🌦️',  // Moderate rain showers
  82: '🌦️',  // Violent rain showers
  85: '🌨️',  // Slight snow showers
  86: '🌨️',  // Heavy snow showers
  95: '⛈️',  // Thunderstorm
  96: '⛈️',  // Thunderstorm with hail
  99: '⛈️'   // Thunderstorm with heavy hail
};

// Get weather icon from code
function getWeatherIcon(code) {
  return weatherIcons[code] || '🌡️';
}

// Get UV index description
function getUviLevel(uvi) {
  if (uvi <= 2) return t('uviLow');
  if (uvi <= 5) return t('uviMod');
  if (uvi <= 7) return t('uviHigh');
  if (uvi <= 10) return t('uviVeryHigh');
  return t('uviExtreme');
}

// Get user's location
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

// Fetch weather from Open-Meteo (free, no API key needed)
async function fetchWeather(lat, lon) {
  // Fetch main weather data with hourly UV for current hour accuracy
  const unitParams = weatherUnits === 'fahrenheit'
    ? '&temperature_unit=fahrenheit&wind_speed_unit=mph'
    : '';
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover&hourly=uv_index&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=auto&forecast_days=4${unitParams}`;
  
  // Fetch air quality data
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`;
  
  const [weatherResponse, aqiResponse] = await Promise.all([
    fetch(weatherUrl),
    fetch(aqiUrl).catch(() => null) // AQI is optional
  ]);
  
  if (!weatherResponse.ok) throw new Error('Weather fetch failed');
  
  const weatherData = await weatherResponse.json();
  console.log('[Weather] API raw data:', weatherData);
  
  let aqi = null;
  if (aqiResponse && aqiResponse.ok) {
    const aqiData = await aqiResponse.json();
    aqi = aqiData.current?.european_aqi;
  }
  
  // Get current hour's UV index from hourly data
  const currentTime = weatherData.current.time; // e.g., "2026-02-08T16:00"
  const currentHourIndex = weatherData.hourly.time.findIndex(t => t === currentTime.substring(0, 13) + ':00');
  const currentUvi = currentHourIndex >= 0 ? weatherData.hourly.uv_index[currentHourIndex] : 0;
  console.log('[Weather] Current time:', currentTime, 'Hour index:', currentHourIndex, 'UV:', currentUvi);
  
  return {
    temp: Math.round(weatherData.current.temperature_2m),
    feelsLike: Math.round(weatherData.current.apparent_temperature),
    humidity: weatherData.current.relative_humidity_2m,
    weatherCode: weatherData.current.weather_code,
    windSpeed: Math.round(weatherData.current.wind_speed_10m),
    windDirection: weatherData.current.wind_direction_10m,
    cloudCover: weatherData.current.cloud_cover,
    uvi: Math.round(currentUvi),
    precipProbability: weatherData.daily.precipitation_probability_max[0],
    aqi: aqi,
    forecast: [1, 2, 3].map(i => ({
      date: weatherData.daily.time[i],
      high: Math.round(weatherData.daily.temperature_2m_max[i]),
      low: Math.round(weatherData.daily.temperature_2m_min[i]),
      code: weatherData.daily.weather_code[i],
      precip: weatherData.daily.precipitation_probability_max[i]
    }))
  };
}

// Get wind direction as compass
function getWindDirection(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Get AQI level and color
function getAqiLevel(aqi) {
  if (aqi <= 20) return { label: t('aqiGood'), color: '#4caf50' };
  if (aqi <= 40) return { label: t('aqiFair'), color: '#8bc34a' };
  if (aqi <= 60) return { label: t('aqiModerate'), color: '#ffeb3b' };
  if (aqi <= 80) return { label: t('aqiPoor'), color: '#ff9800' };
  if (aqi <= 100) return { label: t('aqiVeryPoor'), color: '#f44336' };
  return { label: t('aqiHazardous'), color: '#9c27b0' };
}

// Get city name from coordinates using reverse geocoding
async function getCityName(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ZenLauncherExtension/1.0' }
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.address?.city || data.address?.town || data.address?.village || data.address?.county || null;
  } catch (e) {
    return null;
  }
}

// Render weather widget
function renderWeather(weather, cityName) {
  const container = document.getElementById('weatherContent');
  if (!container || !weather) return;
  
  // Store for re-rendering on language change
  lastWeatherData = weather;
  lastCityName = cityName;
  
  const icon = getWeatherIcon(weather.weatherCode);
  const uviLevel = getUviLevel(weather.uvi);
  const windDir = getWindDirection(weather.windDirection);
  const aqiInfo = weather.aqi ? getAqiLevel(weather.aqi) : null;
  
  // Show feels like only if different from actual temp
  const showFeelsLike = Math.abs(weather.feelsLike - weather.temp) >= 2;
  const unitLabel = weatherUnits === 'fahrenheit' ? '°F' : '°C';
  const windUnit = weatherUnits === 'fahrenheit' ? 'mph' : 'km/h';
  
  container.innerHTML = `
    <div class="weather-row">
      <div class="weather-left">
        <div class="weather-main">
          <span class="weather-icon">${icon}</span>
          <span class="weather-temp">${weather.temp}<span class="weather-unit-toggle" id="weatherUnitToggle" title="${t('weatherUnitToggle')}">${unitLabel}</span></span>
        </div>
        ${cityName ? `<div class="weather-city">${escapeHtml(cityName)}</div>` : ''}
        ${showFeelsLike ? `<div class="weather-feels-like">${t('feelsLike')} ${weather.feelsLike}${unitLabel}</div>` : ''}
      </div>
      <div class="weather-right">
        <div class="weather-detail"><span>💨</span>${weather.windSpeed} ${windUnit} ${windDir}</div>
        <div class="weather-detail"><span>💧</span>${weather.humidity}%</div>
        <div class="weather-detail"><span>☁️</span>${weather.cloudCover}%</div>
        <div class="weather-detail"><span>🌧️</span>${weather.precipProbability}%</div>
        <div class="weather-detail"><span>☀️</span>${weather.uvi} ${uviLevel}</div>
        <div class="weather-detail"><span>🌬️</span>${aqiInfo ? weather.aqi + ' ' + aqiInfo.label : 'N/A'}</div>
      </div>
    </div>
    ${weather.forecast ? `
    <div class="weather-forecast">
      ${weather.forecast.map(day => {
        const d = new Date(day.date + 'T00:00:00');
        const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
        const fIcon = getWeatherIcon(day.code);
        return `<div class="weather-forecast-day">
          <span class="wf-day">${dayName}</span>
          <span class="wf-icon">${fIcon}</span>
          <span class="wf-temps">${day.high}°<span class="wf-low">/${day.low}°</span></span>
        </div>`;
      }).join('')}
    </div>` : ''}
  `;

  // Attach unit toggle click handler
  const toggleBtn = document.getElementById('weatherUnitToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      weatherUnits = weatherUnits === 'celsius' ? 'fahrenheit' : 'celsius';
      chrome.storage.local.set({ weatherUnits });
      // Invalidate cache so fresh data is fetched with new units
      setCacheData('weather', null);
      await fetchWeatherInBackground();
    });
  }
}

// Show weather error
function showWeatherError(message) {
  const container = document.getElementById('weatherContent');
  if (!container) return;
  container.innerHTML = `<div class="weather-error">${escapeHtml(message)}</div>`;
}

// Load weather (with stale-while-revalidate caching)
async function loadWeather() {
  const container = document.getElementById('weatherContent');
  if (!container) return;
  
  // Show cached weather data immediately if available
  if (hasCachedData('weather')) {
    const cached = getCachedData('weather');
    renderWeather(cached.weather, cached.cityName);
    
    // If cache is fresh, don't refetch
    if (isCacheFresh('weather')) {
      return;
    }
    
    // Cache is stale, fetch in background
    fetchWeatherInBackground();
    return;
  }
  
  // No cache, fetch and wait
  await fetchWeatherFresh();
}

// Fetch weather fresh (no cache)
async function fetchWeatherFresh() {
  const container = document.getElementById('weatherContent');
  
  try {
    // Try to get cached location first
    const cached = await new Promise(resolve => {
      chrome.storage.local.get(['weatherLocation', 'weatherCity'], resolve);
    });
    
    let lat, lon, cityName;
    
    if (cached.weatherLocation) {
      lat = cached.weatherLocation.lat;
      lon = cached.weatherLocation.lon;
      cityName = cached.weatherCity;
    } else {
      container.innerHTML = `<div class="weather-loading">${t('detectingLocation')}</div>`;
      
      const location = await getUserLocation();
      lat = location.lat;
      lon = location.lon;
      
      // Get city name
      cityName = await getCityName(lat, lon);
      
      // Cache location
      chrome.storage.local.set({
        weatherLocation: { lat, lon },
        weatherCity: cityName
      });
    }
    
    const weather = await fetchWeather(lat, lon);
    setCacheData('weather', { weather, cityName });
    renderWeather(weather, cityName);
    
  } catch (error) {
    console.error('Weather error:', error);
    if (error.code === 1) {
      showWeatherError(t('locationDenied'));
    } else {
      showWeatherError(t('weatherError'));
    }
  }
}

// Fetch weather in background (silent update)
async function fetchWeatherInBackground() {
  console.log('[Weather] fetchWeatherInBackground started at', new Date().toLocaleTimeString());
  try {
    const cached = await new Promise(resolve => {
      chrome.storage.local.get(['weatherLocation', 'weatherCity'], resolve);
    });
    
    if (cached.weatherLocation) {
      console.log('[Weather] Fetching from API for', cached.weatherCity);
      const weather = await fetchWeather(cached.weatherLocation.lat, cached.weatherLocation.lon);
      console.log('[Weather] API response received:', weather?.current?.temperature_2m);
      setCacheData('weather', { weather, cityName: cached.weatherCity });
      renderWeather(weather, cached.weatherCity);
      console.log('[Weather] Rendered at', new Date().toLocaleTimeString());
    } else {
      console.log('[Weather] No cached location, calling fetchWeatherFresh');
      await fetchWeatherFresh();
    }
  } catch (err) {
    console.error('[Weather] Background refresh failed:', err);
  }
}

// Initialize weather
async function initWeather() {
  console.log('[Weather] initWeather called');
  
  // Load saved unit preference
  const savedPrefs = await new Promise(resolve => {
    chrome.storage.local.get(['weatherUnits'], resolve);
  });
  if (savedPrefs.weatherUnits) {
    weatherUnits = savedPrefs.weatherUnits;
  }
  
  // On page load: show cached immediately, then always fetch fresh
  if (hasCachedData('weather')) {
    const cached = getCachedData('weather');
    console.log('[Weather] Showing cached data');
    renderWeather(cached.weather, cached.cityName);
  }
  
  // Always fetch fresh on page load
  console.log('[Weather] Fetching fresh on page load');
  fetchWeatherInBackground();
  
  // Force refresh every 2 minutes (bypasses cache check)
  weatherUpdateInterval = setInterval(() => {
    console.log('[Weather] Auto-refresh triggered at', new Date().toLocaleTimeString());
    fetchWeatherInBackground();
  }, 2 * 60 * 1000);
}
