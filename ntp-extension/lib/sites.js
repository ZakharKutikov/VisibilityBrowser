// Picks what to show as shortcuts and as recently visited pages.

/** Shown on a fresh profile, before the browser knows the user's own top sites. */
export const STARTER_SITES = [
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'ВКонтакте', url: 'https://vk.com/' },
  { title: 'Telegram', url: 'https://web.telegram.org/' },
  { title: 'Яндекс', url: 'https://ya.ru/' },
  { title: 'Википедия', url: 'https://ru.wikipedia.org/' },
  { title: 'GitHub', url: 'https://github.com/' },
];

export function hostOf(url) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : '';
  } catch { return ''; }
}

/** A short label for a tile: the page title if it is short, otherwise the site name. */
export function tileLabel(site) {
  const host = hostOf(site.url);
  const title = (site.title || '').trim();
  return title && title.length <= 18 ? title : (host || title);
}

/** First letter for the placeholder tile of a site without an icon. */
export function tileLetter(site) {
  const label = (site.title || hostOf(site.url) || '?').trim();
  return [...label][0].toUpperCase();
}

/** Top sites, at most `limit`, one per host. Falls back to the starter set when empty. */
export function pickShortcuts(topSites, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const s of topSites || []) {
    const host = hostOf(s.url);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push({ title: s.title, url: s.url, own: true });
    if (out.length === limit) break;
  }
  return out.length ? out : STARTER_SITES.map((s) => ({ ...s, own: false }));
}

/** Latest history entries, one per host, leaving out hosts already shown as shortcuts. */
export function pickRecent(history, shortcuts, limit = 6) {
  const seen = new Set(shortcuts.filter((s) => s.own).map((s) => hostOf(s.url)));
  const out = [];
  const sorted = [...(history || [])].sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0));
  for (const h of sorted) {
    const host = hostOf(h.url);
    if (!host || seen.has(host)) continue;
    seen.add(host);
    out.push({ title: (h.title || '').trim() || host, url: h.url, host });
    if (out.length === limit) break;
  }
  return out;
}
