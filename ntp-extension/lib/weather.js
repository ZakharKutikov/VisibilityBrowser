// Weather from open-meteo.com, for a city the user typed or found by IP address
// (as 2.1 did, so the weather card works with no setup).

const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';

/** WMO weather code -> message key. */
export function conditionKey(code) {
  if (code === 0) return 'wxClear';
  if (code === 1 || code === 2) return 'wxPartly';
  if (code === 3) return 'wxOvercast';
  if (code === 45 || code === 48) return 'wxFog';
  if (code >= 51 && code <= 55) return 'wxDrizzle';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'wxFreezing';
  if (code >= 61 && code <= 65) return 'wxRain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'wxSnow';
  if (code >= 80 && code <= 82) return 'wxShowers';
  if (code >= 95) return 'wxThunder';
  return 'wxUnknown';
}

/** "-3°" with a real minus sign; never "-0°". */
export function formatTemp(celsius) {
  const n = Math.round(celsius);
  return (n < 0 ? '−' + Math.abs(n) : String(n === 0 ? 0 : n)) + '°';
}

/** Finds a city by name. Returns { name, lat, lon } or null when nothing matches. */
export async function findCity(query, language, fetchFn = fetch) {
  const url = `${GEO}?name=${encodeURIComponent(query)}&count=1&language=${encodeURIComponent(language)}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error('GEO_HTTP_' + res.status);
  const hit = (await res.json())?.results?.[0];
  return hit ? { name: hit.name, lat: hit.latitude, lon: hit.longitude } : null;
}

/** Current conditions at a place. Returns { temp, code }. */
export async function currentWeather({ lat, lon }, fetchFn = fetch) {
  const url = `${FORECAST}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error('WX_HTTP_' + res.status);
  const cur = (await res.json())?.current;
  if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('WX_EMPTY');
  return { temp: cur.temperature_2m, code: cur.weather_code };
}

/**
 * Finds the user's city from their IP address, no typing needed (same idea as
 * 2.1's main.js: try one free lookup, then another). Returns { name, lat, lon }
 * or null if every provider failed or returned nothing usable.
 */
export async function locateByIp(fetchFn = fetch) {
  try {
    const res = await fetchFn('https://ipwhois.app/json/');
    if (res.ok) {
      const d = await res.json();
      if (d && d.success !== false && d.latitude && d.longitude) {
        return { name: d.city || d.region || '', lat: d.latitude, lon: d.longitude };
      }
    }
  } catch { /* try the next provider */ }

  try {
    const res = await fetchFn('https://wttr.in/?format=j1');
    if (res.ok) {
      const area = (await res.json())?.nearest_area?.[0];
      const lat = Number(area?.latitude), lon = Number(area?.longitude);
      if (area && Number.isFinite(lat) && Number.isFinite(lon)) {
        const name = area.areaName?.[0]?.value || area.region?.[0]?.value || '';
        return { name, lat, lon };
      }
    }
  } catch { /* no provider worked */ }

  return null;
}
