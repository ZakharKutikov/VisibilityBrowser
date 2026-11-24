import { greetingKey } from './lib/sky.js';
import { conditionKey, formatTemp, findCity, currentWeather, locateByIp } from './lib/weather.js';
import { pickRecent } from './lib/sites.js';
import { parseGoogleSuggestions, historyToSuggestions, mergeSuggestions } from './lib/suggestions.js';

const $ = (id) => document.getElementById(id);
const t = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
const lang = chrome.i18n.getUILanguage().split('-')[0];
const favicon = (url, size) =>
  `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=${size}`;

document.title = t('pageTitle');
document.documentElement.lang = lang;
for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));

$('footer').textContent = `Visibility Browser v${chrome.runtime.getManifest().version}`;

// ---------- options from the settings page ----------

const options = await chrome.storage.local.get(['ntpShowRecent', 'ntpShowShortcuts', 'ntpSearchEngine']);
$('shortcuts').hidden = options.ntpShowShortcuts === false;

// ---------- clock and greeting ----------

const timeFormat = new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), { hour: '2-digit', minute: '2-digit' });

function tick() {
  const now = new Date();
  $('clock').textContent = timeFormat.format(now);
  $('clock').dateTime = now.toISOString();
  $('greeting').textContent = t(greetingKey(now.getHours()));
  // Wake exactly at the start of the next minute.
  setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20);
}
tick();

// ---------- search or address ----------

function asUrl(text) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  // "example.com", "localhost:3000", "example.com/path" without spaces.
  if (!/\s/.test(text) && /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/.*)?$/i.test(text)) return 'https://' + text;
  return null;
}

function goTo(text) {
  const url = asUrl(text);
  if (url) location.href = url;
  else if (options.ntpSearchEngine) location.href = options.ntpSearchEngine + encodeURIComponent(text);
  else chrome.search.query({ text, disposition: 'CURRENT_TAB' });
}

$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('search-input').value.trim();
  if (!text) return;
  goTo(text);
  hideSuggestions();
});

// ---------- search suggestions (ported from 2.1) ----------

const SEARCH_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
const HISTORY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

function debounce(fn, ms) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function fetchGoogleSuggestions(q) {
  try {
    const resp = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`);
    return parseGoogleSuggestions(await resp.json());
  } catch {
    return [];
  }
}

async function fetchHistorySuggestions(q) {
  const items = await chrome.history.search({ text: q, maxResults: 20 }).catch(() => []);
  return historyToSuggestions(items);
}

let suggestionResults = [];
let selectedIdx = -1;
let outsideClickHandler = null;

function hideSuggestions() {
  $('suggestions').hidden = true;
  suggestionResults = [];
  selectedIdx = -1;
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

function highlightSelected() {
  for (const el of $('suggestions').children) {
    el.classList.toggle('selected', Number(el.dataset.idx) === selectedIdx);
  }
}

function renderSuggestions(results) {
  if (!results.length) return hideSuggestions();

  suggestionResults = results;
  const list = $('suggestions');
  selectedIdx = -1;
  list.replaceChildren(...results.map((res, idx) => {
    const isHistory = res.type === 'history';
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.dataset.idx = String(idx);

    const icon = document.createElement('span');
    icon.className = 'suggestion-icon';
    if (isHistory) {
      const img = document.createElement('img');
      img.src = favicon(res.url, 32);
      img.alt = '';
      img.addEventListener('error', () => { icon.innerHTML = HISTORY_ICON; });
      icon.append(img);
    } else {
      icon.innerHTML = SEARCH_ICON;
    }

    const content = document.createElement('div');
    content.className = 'suggestion-content';
    const text = document.createElement('span');
    text.className = 'suggestion-text';
    text.textContent = res.text;
    content.append(text);
    if (res.url) {
      const urlEl = document.createElement('span');
      urlEl.className = 'suggestion-url';
      urlEl.textContent = res.url;
      content.append(urlEl);
    }

    const type = document.createElement('span');
    type.className = `suggestion-type ${isHistory ? 'type-history' : 'type-search'}`;
    type.textContent = isHistory ? t('suggestTypeHistory') : t('suggestTypeSearch');

    item.append(icon, content, type);
    item.addEventListener('click', () => {
      goTo(res.url || res.text);
      hideSuggestions();
    });
    return item;
  }));

  const rect = $('search-form').getBoundingClientRect();
  list.style.left = `${rect.left}px`;
  list.style.width = `${rect.width}px`;
  list.style.top = `${rect.bottom + 6}px`;
  list.hidden = false;

  if (outsideClickHandler) document.removeEventListener('click', outsideClickHandler);
  outsideClickHandler = (e) => {
    if (!list.contains(e.target) && e.target !== $('search-input')) hideSuggestions();
  };
  setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);
}

const updateSuggestions = debounce(async (q) => {
  q = q.trim();
  if (q.length < 2) return hideSuggestions();
  const [historyItems, searchItems] = await Promise.all([
    fetchHistorySuggestions(q),
    fetchGoogleSuggestions(q),
  ]);
  renderSuggestions(mergeSuggestions(historyItems, searchItems));
}, 100);

$('search-input').addEventListener('input', () => updateSuggestions($('search-input').value));

$('search-input').addEventListener('keydown', (e) => {
  if ($('suggestions').hidden) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIdx = (selectedIdx + 1) % suggestionResults.length;
    highlightSelected();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIdx = (selectedIdx - 1 + suggestionResults.length) % suggestionResults.length;
    highlightSelected();
  } else if (e.key === 'Enter' && selectedIdx !== -1) {
    e.preventDefault();
    const res = suggestionResults[selectedIdx];
    goTo(res.url || res.text);
    hideSuggestions();
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

$('search-input').addEventListener('blur', () => setTimeout(hideSuggestions, 200));

// ---------- recent visits ----------

function renderRecent(items) {
  $('recent-section').hidden = items.length === 0;
  $('recent').replaceChildren(...items.map((item) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.url;
    a.title = item.url;

    const img = document.createElement('img');
    img.src = favicon(item.url, 32);
    img.alt = '';

    const name = document.createElement('span');
    name.className = 'recent-name';
    name.textContent = item.title;

    const host = document.createElement('span');
    host.className = 'recent-host';
    host.textContent = item.host;

    a.append(img, name, host);
    li.append(a);
    return li;
  }));
}

async function loadRecent() {
  if (options.ntpShowRecent === false) return;
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const history = await chrome.history.search({ text: '', startTime: weekAgo, maxResults: 80 }).catch(() => []);
  renderRecent(pickRecent(history, [], 8));
}
loadRecent();

// ---------- weather ----------

const WEATHER_TTL = 15 * 60 * 1000;
const WEATHER_ICON = {
  wxClear: '☀️', wxPartly: '⛅', wxOvercast: '☁️', wxFog: '🌫️', wxDrizzle: '🌦️',
  wxFreezing: '🌨️', wxRain: '🌧️', wxSnow: '❄️', wxShowers: '🌧️', wxThunder: '⛈️', wxUnknown: '🌤️',
};

function showWeather(city, wx) {
  if (city && wx) {
    const key = conditionKey(wx.code);
    $('weather-icon').textContent = WEATHER_ICON[key] || '🌤️';
    $('weather-temp').textContent = formatTemp(wx.temp);
    $('weather-text').textContent = [t(key), city.name].filter(Boolean).join(' · ');
    $('weather-now').title = t('weatherChange');
  } else {
    $('weather-icon').textContent = '🌤️';
    $('weather-temp').textContent = '--°C';
    $('weather-text').textContent = t('weatherSet');
    $('weather-now').title = t('weatherSet');
  }
}

function weatherError(text) {
  $('weather-error').textContent = text;
  $('weather-error').hidden = !text;
}

async function loadWeather() {
  let { city, weather, citySource } = await chrome.storage.local.get(['city', 'weather', 'citySource']);

  // No city yet (first run, or IP lookup never worked): try the user's IP
  // once, like 2.1 did, so the card works with nothing typed. A city the
  // user picked themselves (citySource === 'manual') is never overwritten.
  if (!city && citySource !== 'manual') {
    const found = await locateByIp().catch(() => null);
    if (found) {
      city = found;
      await chrome.storage.local.set({ city, citySource: 'auto' });
    }
  }
  if (!city) return showWeather(null);

  // Show what we have at once, then refresh it if it is stale.
  showWeather(city, weather || null);
  if (weather && Date.now() - weather.at < WEATHER_TTL) return;
  try {
    const fresh = { ...(await currentWeather(city)), at: Date.now() };
    await chrome.storage.local.set({ weather: fresh });
    showWeather(city, fresh);
    weatherError('');
  } catch {
    if (!weather) weatherError(t('weatherOffline'));
  }
}

function editCity(open) {
  $('city-form').hidden = !open;
  $('weather-now').hidden = open;
  if (open) {
    weatherError('');
    $('city-input').focus();
    $('city-input').select();
  }
}

$('weather-now').addEventListener('click', async () => {
  $('city-input').value = (await chrome.storage.local.get('city')).city?.name || '';
  editCity(true);
});

$('city-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = $('city-input').value.trim();
  if (!query) return;
  try {
    const city = await findCity(query, lang);
    if (!city) return weatherError(t('cityNotFound', query));
    await chrome.storage.local.set({ city, citySource: 'manual' });
    await chrome.storage.local.remove('weather');
  } catch {
    return weatherError(t('weatherOffline'));
  }
  editCity(false);
  loadWeather();
});

$('city-remove').addEventListener('click', async () => {
  // "Don't show weather": remembered as a manual choice, so the next IP
  // lookup does not bring the card back on its own.
  await chrome.storage.local.remove(['city', 'weather']);
  await chrome.storage.local.set({ citySource: 'manual' });
  editCity(false);
  weatherError('');
  loadWeather();
});

$('city-form').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { editCity(false); weatherError(''); loadWeather(); }
});

loadWeather();
