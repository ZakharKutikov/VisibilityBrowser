// Visibility: the new-tab search box's suggestion dropdown, ported from 2.1
// (legacy-electron/renderer.js's updateSuggestions/fetchGoogleSuggestions/
// fetchHistorySuggestions). Pure helpers only; the actual fetch() and
// chrome.history.search() calls live in newtab.js.

export function parseGoogleSuggestions(json, max = 6) {
  const list = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  return list.slice(0, max).map((text) => ({ type: 'search', text, url: null }));
}

export function historyToSuggestions(historyItems, max = 4) {
  const seen = new Set();
  const out = [];
  for (const h of historyItems || []) {
    const key = (h.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ type: 'history', text: h.title, url: h.url || '' });
    if (out.length >= max) break;
  }
  return out;
}

export function mergeSuggestions(historyItems, searchItems) {
  return historyItems.length ? [...historyItems, ...searchItems] : searchItems;
}
