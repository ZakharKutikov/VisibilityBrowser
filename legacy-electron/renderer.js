'use strict';
const { ipcRenderer, webFrame } = require('electron');
const { matchShortcut } = require('./shortcuts-shared');

const DINO_GAME_URL = 'https://dinorunner.com/ru/';

const crashRecoveryAt = new Map();
const tabRecoverHandlers = new Map();
let lastToastMsg = '';
let lastToastAt = 0;

function setGuestTabActive(tab, active) {
  if (!tab?.guestId) return;
  ipcRenderer.send('guest-tab-active', { guestId: tab.guestId, active: !!active });
}

function bindGuestWebview(tab, wv) {
  const bind = () => {
    try {
      tab.guestId = wv.getWebContentsId();
      setGuestTabActive(tab, tab.id === activeTabId);
    } catch (e) {}
  };
  try {
    if (wv.getWebContentsId && wv.getWebContentsId()) bind();
    else wv.addEventListener('dom-ready', bind, { once: true });
  } catch (e) {
    wv.addEventListener('dom-ready', bind, { once: true });
  }
}

let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;
let isIncognito = false;
let currentZoom = 1.0;
let settings = {};
let closedTabsStack = [];
let bookmarksCache = [];
let downloads = {};

const tabsBar = document.getElementById('tabs-bar');
const newTabBtn = document.getElementById('new-tab-btn');
const webviewsWrap = document.getElementById('webviews-wrap');
const urlBar = document.getElementById('url-bar');
const urlBarWrap = document.getElementById('url-bar-wrap');
const secIcon = document.getElementById('security-icon');
const loadingBar = document.getElementById('loading-bar');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');
const bookmarksList = document.getElementById('bookmarks-list');
const historySearch = document.getElementById('history-search');
const dlList = document.getElementById('dl-list');
const downloadsPanel = document.getElementById('downloads-panel');
const bookmarksBar = document.getElementById('bookmarks-bar');
const bookmarksScroll = document.getElementById('bookmarks-scroll');
const bookmarksSearch = document.getElementById('bookmarks-search');
const bmCtxMenu = document.getElementById('bm-ctx-menu');
const incognitoPill = document.getElementById('incognito-pill');
const statusUrl = document.getElementById('status-url');
const statusZoom = document.getElementById('status-zoom');
const statusIncognito = document.getElementById('status-incognito');
const zoomDisplay = document.getElementById('zoom-display');
const ntpPage = document.getElementById('new-tab-page');
const ntpSearchInput = document.getElementById('ntp-search-input');
const suggestionsDropdown = document.getElementById('suggestions-dropdown');

let suggestionResults = [];
let selectedSuggestionIdx = -1;
let lastSuggestionQuery = '';

const uiSvg = {
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  reload: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
};

function setReloadButtonLoading(isLoading) {
  const reloadBtn = document.getElementById('btn-reload');
  if (!reloadBtn) return;
  reloadBtn.innerHTML = isLoading ? uiSvg.stop : uiSvg.reload;
}

function toast(msg, duration = 2800) {
  const now = Date.now();
  if (msg === lastToastMsg && now - lastToastAt < 2500) return;
  lastToastMsg = msg;
  lastToastAt = now;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('closing');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

function showBanner(options) {
  const { 
    title, 
    message, 
    type = 'info', // 'info' | 'error' | 'warning' | 'success'
    icon = null,
    duration = 4000,
    persistent = false
  } = typeof options === 'string' ? { title: options } : options;
  
  const icons = {
    error: uiSvg.error,
    warning: uiSvg.warning,
    success: uiSvg.success,
    info: uiSvg.info,
  };
  
  const banner = document.createElement('div');
  banner.className = `banner ${type}${persistent ? ' persistent' : ''}`;
  
  const iconHtml = icon || icons[type] || icons.info;
  
  banner.innerHTML = `
    <span class="banner-icon">${iconHtml}</span>
    <div class="banner-content">
      ${title ? `<div class="banner-title">${escHtml(title)}</div>` : ''}
      ${message ? `<div class="banner-message">${escHtml(message)}</div>` : ''}
    </div>
    <button class="banner-close" title="${window.t ? window.t('btn-close', 'Закрыть') : 'Закрыть'}">${uiSvg.close}</button>
  `;
  
  banner.querySelector('.banner-close').onclick = () => {
    banner.style.animation = 'banner-out 0.2s ease forwards';
    setTimeout(() => banner.remove(), 200);
  };
  
  document.getElementById('banner-container').appendChild(banner);
  
  if (!persistent && duration > 0) {
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.animation = 'banner-out 0.3s ease forwards';
        setTimeout(() => banner.remove(), 300);
      }
    }, duration);
  }
  
  return banner;
}

function showError(message, title = null) {
  const t = window.t || ((k, f) => f || k);
  return showBanner({ type: 'error', title: title || t('banner-error', 'Ошибка'), message });
}
function showWarning(message, title = null) {
  const t = window.t || ((k, f) => f || k);
  return showBanner({ type: 'warning', title: title || t('banner-warning', 'Внимание'), message });
}
function showSuccess(message, title = null) {
  const t = window.t || ((k, f) => f || k);
  return showBanner({ type: 'success', title: title || t('banner-success', 'Успех'), message });
}
function showInfo(message, title = null) {
  const t = window.t || ((k, f) => f || k);
  return showBanner({ type: 'info', title: title || t('banner-info', 'Информация'), message });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s) {
  return String(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function updateZoomUI() {
  const pct = Math.round(currentZoom * 100) + '%';
  zoomDisplay.textContent = pct;
  statusZoom.textContent = pct;
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId);
}

function resolveUrl(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'dino' || lower === 'динозаврик' || lower === 'chrome://dino' || lower === 'chrome://dino/' || lower === 'visib://dino') {
    return DINO_GAME_URL;
  }
  if (raw.startsWith('chrome://')) {
    if (/dino/i.test(raw)) return DINO_GAME_URL;
    return 'data:text/html;charset=utf-8,' + encodeURIComponent(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0d0d0f;color:#f0f0f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}p{max-width:420px;line-height:1.6;color:#aaa}strong{color:#8b9aff}</style></head><body><p>Страницы <strong>chrome://</strong> недоступны во вкладках.<br>Для игры введите: <strong>dino</strong></p></body></html>'
    );
  }
  if (raw.startsWith('view-source:') || raw.startsWith('about:') || raw.startsWith('file:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.includes('://')) {
    if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(raw) && !raw.includes(' ')) return 'https://' + raw;
    const engine = settings.searchEngine || 'https://www.google.com/search?q=';
    return engine + encodeURIComponent(raw);
  }
  return raw;
}

const VOICE_DOMAINS = ['discord.com', 'discordapp.com', 'discord.gg', 'discord.media', 'discordapp.net', 'meet.google.com', 'zoom.us', 'teams.microsoft.com', 'web.telegram.org', 'web.skype.com'];

function isVoiceUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('about:') || url.startsWith('view-source:')) return false;
  try {
    const host = new URL(url).hostname;
    return VOICE_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch (e) { return false; }
}

function getBrowserViewBounds() {
  const wrap = webviewsWrap;
  if (!wrap) return { x: 0, y: 0, width: 800, height: 600 };
  const rect = wrap.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height))
  };
}

function getTabUrl(tab) {
  if (!tab) return '';
  if (tab.useBrowserView) return tab.url || '';
  try { return tab.webview?.getURL?.() || tab.url || ''; } catch (e) { return tab.url || ''; }
}

function hookWebviewPlugins(wv) {
  if (typeof window.initWebviewExtensions === 'function') window.initWebviewExtensions(wv);
  if (typeof window.hookWebviewWindowFix === 'function') window.hookWebviewWindowFix(wv);
  if (typeof window.hookFindInPage === 'function') window.hookFindInPage(wv);
  if (typeof window.hookBrowserShortcuts === 'function') window.hookBrowserShortcuts(wv);
}

function detachWebviewTab(tab) {
  if (!tab?.webview) return;
  if (tab.guestId) ipcRenderer.send('guest-tab-release', tab.guestId);
  tabRecoverHandlers.delete(tab.id);
  try { tab.webview.remove(); } catch (e) {}
  tab.webview = null;
  tab.guestId = null;
}

function attachWebviewToTab(tab, initialUrl) {
  const partition = tab.incognito ? 'incognito' : 'persist:main';
  const wv = document.createElement('webview');
  wv.id = 'wv-' + tab.id;
  wv.setAttribute('partition', partition);
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'nodeIntegration=no,contextIsolation=yes');
  if (tab.id === activeTabId && !tab.isNewTabPage) {
    wv.classList.add('active');
  } else {
    wv.classList.remove('active');
  }
  if (initialUrl && initialUrl !== 'about:blank') {
    wv.setAttribute('src', initialUrl);
  }
  setupWebviewEvents(wv, tab.id);
  webviewsWrap.appendChild(wv);
  tab.webview = wv;
  bindGuestWebview(tab, wv);
  hookWebviewPlugins(wv);
  tabRecoverHandlers.set(tab.id, () => recoverCrashedTab(tab));
  return wv;
}

function recoverCrashedTab(tab) {
  if (!tab || tab.useBrowserView || tab._recovering) return;
  const now = Date.now();
  const last = crashRecoveryAt.get(tab.id) || 0;
  if (now - last < 2000) return;
  crashRecoveryAt.set(tab.id, now);

  const fallbackUrl = settings.homepage || 'https://www.google.com';
  const url = (tab.url && !tab.url.startsWith('data:') && tab.url !== 'about:blank') ? tab.url : fallbackUrl;

  tab._crashRetries = (tab._crashRetries || 0) + 1;
  if (tab._crashRetries > 3) {
    if (tab.webview) {
      const retryHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0e0f14;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;user-select:none;}.c{max-width:400px;padding:24px;}.icon{font-size:42px;margin-bottom:12px;}h1{font-size:18px;margin-bottom:8px;font-weight:600;}p{font-size:13px;color:#94a3b8;margin-bottom:20px;line-height:1.5;}button{background:#3b82f6;border:none;color:#fff;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;}button:hover{background:#2563eb;}</style></head><body><div class="c"><div class="icon">⚡</div><h1>Страница неожиданно закрылась</h1><p>Вкладка столкнулась со сбоем. Нажмите кнопку ниже, чтобы перезапустить ее.</p><button onclick="location.href='${url}'">Перезагрузить страницу</button></div></body></html>`)}`;
      try { tab.webview.src = retryHtml; } catch (e) {}
    }
    toast(window.t ? window.t('toast-tab-crash-fail', 'Вкладка не отвечает. Нажмите перезагрузить.') : 'Вкладка не отвечает. Нажмите перезагрузить.');
    return;
  }

  tab._recovering = true;
  toast(window.t ? window.t('toast-tab-crashed', 'Вкладка упала. Восстановление...') : 'Вкладка упала. Восстановление...');

  setTimeout(() => {
    try {
      detachWebviewTab(tab);
      attachWebviewToTab(tab, url);
      if (tab.id === activeTabId && tab.webview) {
        tab.webview.classList.add('active');
      }
    } catch (e) {
      console.error('Failed to recreate webview:', e);
    } finally {
      tab._recovering = false;
    }
  }, 300);
}

function markVoiceTab(tab) {
  if (!tab || tab.voiceMode) return;
  tab.voiceMode = true;
  tab.element.classList.add('voice-tab');
}

async function migrateTabToBrowserView(tab, url) {
  if (!tab || tab.useBrowserView) return;
  tab.useBrowserView = true;
  markVoiceTab(tab);
  if (tab.webview) {
    tab.webview.remove();
    tab.webview = null;
  }
  const bounds = getBrowserViewBounds();
  const partition = tab.incognito ? 'incognito' : 'persist:main';
  const loadUrl = url || tab.url;
  if (loadUrl) {
    tab.isNewTabPage = false;
    tab.url = loadUrl;
    await ipcRenderer.invoke('bv-create', { tabId: tab.id, url: loadUrl, bounds, partition });
  }
  if (activeTabId === tab.id && !tab.isNewTabPage) {
    ntpPage.classList.remove('active');
    ipcRenderer.send('bv-show', { tabId: tab.id, bounds: getBrowserViewBounds() });
  }
}

async function createBrowserViewForTab(tab, url) {
  tab.useBrowserView = true;
  tab.webview = null;
  markVoiceTab(tab);
  const bounds = getBrowserViewBounds();
  const partition = tab.incognito ? 'incognito' : 'persist:main';
  await ipcRenderer.invoke('bv-create', { tabId: tab.id, url, bounds, partition });
}

function syncBrowserViewBounds() {
  const tab = getActiveTab();
  if (tab?.useBrowserView && !tab.isNewTabPage) {
    ipcRenderer.send('bv-bounds', { tabId: tab.id, bounds: getBrowserViewBounds() });
  }
}

async function tabGoBack(tab) {
  if (!tab) return;
  if (tab.useBrowserView) ipcRenderer.send('bv-go-back', tab.id);
  else try { if (tab.webview?.canGoBack()) tab.webview.goBack(); } catch (e) {}
}

async function tabGoForward(tab) {
  if (!tab) return;
  if (tab.useBrowserView) ipcRenderer.send('bv-go-forward', tab.id);
  else try { if (tab.webview?.canGoForward()) tab.webview.goForward(); } catch (e) {}
}

function tabReload(tab, ignoreCache = false) {
  if (!tab) return;
  if (tab.useBrowserView) ipcRenderer.send('bv-reload', tab.id);
  else if (ignoreCache) tab.webview?.reloadIgnoringCache?.();
  else tab.webview?.reload?.();
}

function tabStop(tab) {
  if (!tab) return;
  if (tab.useBrowserView) ipcRenderer.send('bv-stop', tab.id);
  else tab.webview?.stop?.();
}

async function refreshNavButtonsAsync() {
  const tab = getActiveTab();
  const back = document.getElementById('btn-back');
  const fwd = document.getElementById('btn-forward');
  if (!tab || tab.isNewTabPage) {
    back.disabled = true;
    fwd.disabled = true;
    return;
  }
  if (tab.useBrowserView) {
    try {
      back.disabled = !(await ipcRenderer.invoke('bv-can-go-back', tab.id));
      fwd.disabled = !(await ipcRenderer.invoke('bv-can-go-forward', tab.id));
    } catch (e) {
      back.disabled = true;
      fwd.disabled = true;
    }
    return;
  }
  try {
    back.disabled = !tab.webview.canGoBack();
    fwd.disabled = !tab.webview.canGoForward();
  } catch (e) {
    back.disabled = true;
    fwd.disabled = true;
  }
}

function formatBytes(b) {
  if (!b || b <= 0) return '?';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  const mbps = bytesPerSec / 1048576;
  if (mbps < 0.1) return (bytesPerSec / 1024).toFixed(1) + ' КБ/с';
  return mbps.toFixed(2) + ' МБ/с';
}

function getFileIcon(ext) {
  ext = (ext || '').toLowerCase();
  const s = (d, color = 'currentColor') => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm'];
  const audioExts = ['mp3', 'wav', 'flac', 'ogg'];
  const codeExts = ['js', 'html', 'css', 'py', 'c', 'cpp', 'java', 'json', 'md'];

  if (imageExts.includes(ext)) return s('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>', '#a78bfa');
  if (archiveExts.includes(ext)) return s('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>', '#ff9800');
  if (videoExts.includes(ext)) return s('<polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>', '#f44336');
  if (audioExts.includes(ext)) return s('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', '#4caf50');
  if (codeExts.includes(ext)) return s('<polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>', '#2196f3');
  if (ext === 'exe' || ext === 'msi') return s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', '#ff9800');
  if (ext === 'pdf') return s('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', '#f44336');
  return s('<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13,2 13,9 20,9"/>');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let dragSrcTabId = null;
let dragOverTabId = null;

function addTabDragEvents(tabEl, id) {
  tabEl.setAttribute('draggable', 'true');

  tabEl.addEventListener('dragstart', (e) => {
    dragSrcTabId = id;
    dragOverTabId = null;
    e.dataTransfer.effectAllowed = 'move';
    tabEl.style.opacity = '0.5';
  });

  tabEl.addEventListener('dragend', () => {
    tabEl.style.opacity = '';
    if (dragOverTabId !== null) {
      const dragEl = document.getElementById('tab-' + dragOverTabId);
      if (dragEl) dragEl.classList.remove('drag-over');
      dragOverTabId = null;
    }
  });

  tabEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (dragSrcTabId !== id) {
      if (dragOverTabId !== null && dragOverTabId !== id) {
        const prevEl = document.getElementById('tab-' + dragOverTabId);
        if (prevEl) prevEl.classList.remove('drag-over');
      }
      dragOverTabId = id;
      tabEl.classList.add('drag-over');
    }
  });

  tabEl.addEventListener('drop', (e) => {
    e.preventDefault();
    tabEl.classList.remove('drag-over');
    dragOverTabId = null;
    
    if (dragSrcTabId === null || dragSrcTabId === id) return;

    const fromIdx = tabs.findIndex(t => t.id === dragSrcTabId);
    const toIdx = tabs.findIndex(t => t.id === id);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = tabs.splice(fromIdx, 1);
    tabs.splice(toIdx, 0, moved);

    const fromEl = document.getElementById('tab-' + dragSrcTabId);
    const toEl = document.getElementById('tab-' + id);
    if (!fromEl || !toEl) return;
    if (fromIdx < toIdx) {
      tabsBar.insertBefore(fromEl, toEl.nextSibling);
    } else {
      tabsBar.insertBefore(fromEl, toEl);
    }

    dragSrcTabId = null;
  });
}

function createNewTab(url, incognitoTab = false) {
  const id = ++tabIdCounter;
  const partition = incognitoTab ? 'incognito' : 'persist:main';

  const isNewTabPage = !url;
  const resolvedUrl = url ? resolveUrl(url) : null;

  const tabEl = document.createElement('div');
  tabEl.className = 'tab' + (incognitoTab ? ' incognito-tab' : '');
  tabEl.id = 'tab-' + id;
  tabEl.innerHTML = `
    <span class="tab-favicon" id="fav-${id}">${uiSvg.globe}</span>
    <span class="tab-title" id="title-${id}">${(window.t ? window.t('tab-new', 'New Tab') : 'New Tab')}</span>
    <span class="tab-audio" id="audio-${id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></span>
    <button class="tab-close" title="Закрыть (Ctrl+W)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  `;
  const closeBtn = tabEl.querySelector('.tab-close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(id);
  });
  tabEl.addEventListener('click', (e) => {
    if (!e.target.closest('.tab-close') && !e.target.closest('.tab-audio')) {
      switchTab(id);
    }
  });
  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ipcRenderer.send('show-tab-context-menu', { id });
  });
  tabEl.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      closeTab(id);
    }
  });

  tabsBar.insertBefore(tabEl, newTabBtn);
  addTabDragEvents(tabEl, id);

  const useBV = resolvedUrl && isVoiceUrl(resolvedUrl);
  let wv = null;

  const tab = {
    id, element: tabEl, webview: null,
    url: resolvedUrl || '',
    title: (window.t ? window.t('tab-new', 'New Tab') : 'New Tab'),
    incognito: incognitoTab,
    zoom: currentZoom,
    favicon: '',
    isNewTabPage,
    isMuted: false,
    sslInvalid: false,
    lastActiveTime: Date.now(),
    sleeping: false,
    useBrowserView: useBV,
    voiceMode: useBV,
    mediaPlaying: false
  };
  tabs.push(tab);

  if (!useBV) {
    wv = attachWebviewToTab(tab, resolvedUrl || null);
  }

  tabEl.classList.add('tab-enter');
  setTimeout(() => tabEl.classList.remove('tab-enter'), 300);

  if (useBV) {
    markVoiceTab(tab);
    createBrowserViewForTab(tab, resolvedUrl);
  }

  switchTab(id, true);

  updateTabWidths();

  if (typeof window.hookTabPreview === 'function') window.hookTabPreview(tabEl, id);

  const audioEl = tabEl.querySelector('.tab-audio');
  if (audioEl) {
    audioEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMute(id);
    });
  }

  return id;
}

function setupWebviewEvents(wv, id) {
  const titleTimers = {};

  wv.addEventListener('will-navigate', (e) => {
    if (!e.url) return;
    if (e.url.startsWith('chrome://')) {
      e.preventDefault();
      wv.src = /dino/i.test(e.url) ? DINO_GAME_URL : resolveUrl('chrome://blocked');
    }
  });

  wv.addEventListener('dom-ready', () => {
    try {
      wv.executeJavaScript(`
        try {
          window.__VISIBILITY_BROWSER__ = true;
          window.visibilityBrowser = { name: 'Visibility Browser', version: '2.1.0', studio: 'GOmp Studios' };
          document.documentElement.setAttribute('data-browser', 'visibility');
          window.dispatchEvent(new CustomEvent('visibility-browser-detected', { detail: { version: '2.1.0' } }));
        } catch(e) {}
      `).catch(() => {});
    } catch (e) {}
  });

  wv.addEventListener('did-start-loading', () => {
    if (getActiveTab()?.id === id) {
      loadingBar.classList.add('active');
      setReloadButtonLoading(true);
    }
  });

  wv.addEventListener('did-stop-loading', () => {
    const tab = tabs.find(x => x.id === id);
    if (tab) tab._crashRetries = 0;
    if (getActiveTab()?.id === id) {
      loadingBar.classList.remove('active');
      setReloadButtonLoading(false);
      let u = '';
      try { u = wv.getURL(); } catch (e) { u = tab ? tab.url : ''; }
      if (tab) tab.url = u;
      if (!tab || tab.isNewTabPage || u.startsWith('data:') || u === 'about:blank') u = '';
      urlBar.value = u;
      updateSecurityIcon(u);
      updateNavButtons();
    }
    try {
      let t = '';
      try { t = wv.getTitle?.() || ''; } catch (err) {}
      if (!t) {
        const currentTab = tabs.find(x => x.id === id);
        t = currentTab?.title || '';
      }
      if (t) updateTabTitle(id, t);

      const tab = tabs.find(x => x.id === id);
      if (tab && !tab.incognito) {
        let u = '';
        try { u = wv.getURL(); } catch (e) { u = tab.url; }
        if (u && !u.startsWith('data:') && u !== 'about:blank') {
          tab.url = u;
          ipcRenderer.send('add-to-history', { url: u, title: t || u });
        }
      }
    } catch (e) { }
  });

  wv.addEventListener('media-started-playing', () => {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const audioEl = tab.element.querySelector('.tab-audio');
    if (audioEl) {
      audioEl.style.display = 'flex';
      if (!tab.isMuted) {
        audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        audioEl.classList.remove('muted');
      }
    }
  });

  wv.addEventListener('media-paused', () => {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    if (!tab.isMuted) {
      const audioEl = tab.element.querySelector('.tab-audio');
      if (audioEl) audioEl.style.display = 'none';
      audioEl?.classList.remove('muted');
    }
  });

  wv.addEventListener('page-title-updated', e => {
    clearTimeout(titleTimers[id]);
    titleTimers[id] = setTimeout(() => {
      updateTabTitle(id, e.title);
      if (getActiveTab()?.id === id) document.title = e.title + ' — Visibility Browser';
    }, 200);
  });

  wv.addEventListener('page-favicon-updated', e => {
    if (e.favicons?.length) {
      const favEl = document.getElementById('fav-' + id);
      if (favEl) favEl.innerHTML = `<img src="${e.favicons[0]}" style="width:16px;height:16px;object-fit:contain" onerror="this.parentElement.innerHTML='${uiSvg.globe.replace(/"/g, '&quot;')}'">`;
      const tab = tabs.find(t => t.id === id);
      if (tab) tab.favicon = e.favicons[0];
    }
  });

  wv.addEventListener('did-navigate', e => {
    const tab = tabs.find(t => t.id === id);
    if (tab && !e.url.startsWith('data:') && e.url !== 'about:blank') {
      tab.url = e.url; tab.isNewTabPage = false;
      tab._thumbnail = null;
    }
    if (tab && isVoiceUrl(e.url)) {
      migrateTabToBrowserView(tab, e.url);
      return;
    }
    if (getActiveTab()?.id === id) {
      let u = e.url;
      if (!tab || tab.isNewTabPage || u.startsWith('data:') || u === 'about:blank') u = '';
      urlBar.value = u;
      updateSecurityIcon(u);
      updateNavButtons();
      updateBookmarkBtn(u);
      if (tab && !tab.isNewTabPage) {
        ntpPage.classList.remove('active');
        tab.webview.classList.add('active');
      }
    }
  });

  wv.addEventListener('did-navigate-in-page', e => {
    const tab = tabs.find(t => t.id === id);
    if (getActiveTab()?.id === id && e.isMainFrame) {
      let u = '';
      try { u = wv.getURL(); } catch (err) { u = tab ? tab.url : ''; }
      if (!tab || tab.isNewTabPage || u.startsWith('data:') || u === 'about:blank') u = '';
      urlBar.value = u;

      if (tab) tab.sslInvalid = false;

      updateNavButtons();
    }
  });

  wv.addEventListener('did-fail-load', e => {
    if (e.errorCode === -3 || !e.isMainFrame) return;

    const tab = tabs.find(t => t.id === id);
    if (!tab || tab._recovering) return;

    if (getActiveTab()?.id === id) {
      loadingBar.classList.remove('active');
      setReloadButtonLoading(false);
    }

    const isSslError = e.errorCode <= -200 && e.errorCode >= -299;
    if (tab) tab.sslInvalid = isSslError;

    const errorPageHtml = generateErrorPage(e.validatedURL, e.errorDescription, isSslError);
    wv.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(errorPageHtml);

    if (getActiveTab()?.id === id) {
      updateSecurityIcon(tab.url, isSslError);
    }
  });

  wv.addEventListener('console-message', e => {
    if (e.message.startsWith('visib-bypass:')) {
      const urlToBypass = e.message.replace('visib-bypass:', '');
      try {
        const hostname = new URL(urlToBypass).hostname;
        ipcRenderer.send('whitelist-ssl', hostname);
        wv.loadURL(urlToBypass);
      } catch (err) { }
    }
  });

  wv.addEventListener('context-menu', e => {
    contextMenuTabId = id;
    ipcRenderer.send('show-context-menu', {
      x: e.params.x, y: e.params.y,
      linkURL: e.params.linkURL || '',
      srcURL: e.params.srcURL || '',
      mediaType: e.params.mediaType || 'none',
      selectionText: e.params.selectionText || '',
      isEditable: e.params.isEditable || false,
    });
  });

  wv.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url && !e.url.startsWith('about:blank')) {
      const currentTab = tabs.find(t => t.id === id);
      createNewTab(e.url, currentTab ? currentTab.incognito : isIncognito);
    }
  });

  wv.addEventListener('render-process-gone', (e) => {
    console.warn('[Webview] Render process gone in tab', id, e.details || e);
    const tab = tabs.find(t => t.id === id);
    if (tab) recoverCrashedTab(tab);
  });
  wv.addEventListener('plugin-crashed', (e) => {
    console.warn('[Webview] Plugin crashed in tab', id, e);
  });
}

let contextMenuTabId = null; // tracks which tab spawned the context menu

function getContextTab() {
  const t = tabs.find(t => t.id === contextMenuTabId);
  return t || getActiveTab();
}

ipcRenderer.on('open-url-in-new-tab', (e, url) => {
  createNewTab(url);
});

ipcRenderer.on('download-image', (e, url) => {
  ipcRenderer.send('force-download-url', url);
});

ipcRenderer.on('duplicate-tab', (e, id) => duplicateTab(id));
ipcRenderer.on('close-tab', (e, id) => closeTab(id));
ipcRenderer.on('close-tabs-to-right', (e, id) => closeTabsToRight(id));
ipcRenderer.on('close-other-tabs', (e, id) => closeOtherTabs(id));
ipcRenderer.on('close-all-tabs', () => closeAllTabs());

ipcRenderer.on('trigger-pip', () => {
  const tab = getContextTab();
  if (!tab) return;
  const t = window.t || ((k, f) => f || k);
  const vidNotFound = JSON.stringify(t('vid-not-found', 'Video not found on this page.'));
  const pipFail = JSON.stringify(t('vid-pip-fail', 'PiP unavailable: '));
  tab.webview.executeJavaScript(`
    (function() {
      const v = document.querySelector('video');
      if (!v) { alert(${vidNotFound}); return; }
      if (document.pictureInPictureElement) document.exitPictureInPicture();
      else v.requestPictureInPicture().catch(e => alert(${pipFail} + e.message));
    })();
  `).catch(() => { });
});

ipcRenderer.on('inspect-element', (e, { x, y }) => {
  const tab = getContextTab();
  if (tab?.webview) tab.webview.inspectElement(x, y);
});

ipcRenderer.on('view-source', () => {
  const tab = getContextTab();
  if (tab) createNewTab('view-source:' + getTabUrl(tab));
});

ipcRenderer.on('reload-page', () => {
  const tab = getActiveTab();
  if (tab) tabReload(tab);
});

ipcRenderer.on('search-selected', (e, text) => {
  createNewTab(resolveUrl(text));
});

function switchTab(id, skipAnim = false) {
  const prevTab = getActiveTab();
  if (prevTab?.guestId) setGuestTabActive(prevTab, false);
  if (prevTab && prevTab.useBrowserView) {
    ipcRenderer.send('bv-hide-all');
  }

  tabs.forEach(t => {
    t.element.classList.remove('active');
    if (t.webview) {
      t.webview.classList.remove('active');
    }
  });
  
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  
  tab.element.classList.add('active');
  activeTabId = id;
  if (!skipAnim) {
    tab.element.classList.add('tab-switch-in');
    setTimeout(() => tab.element.classList.remove('tab-switch-in'), 300);
  }
  tab.lastActiveTime = Date.now();
  if (tab.sleeping && typeof window.wakeTab === 'function') window.wakeTab(tab);
  if (typeof window.onTabSwitchedForFind === 'function') window.onTabSwitchedForFind();

  let url = tab.url || '';
  if (tab.isNewTabPage || url.startsWith('data:') || url === 'about:blank') url = '';
  
  urlBar.value = url;
  updateSecurityIcon(url);
  refreshNavButtonsAsync();
  updateBookmarkBtn(url);
  document.title = tab.title + ' — Visibility Browser';
  if (tab.zoom) setZoom(tab.zoom);

  if (tab.isNewTabPage) {
    ntpPage.classList.add('active');
    ipcRenderer.send('bv-hide-all');
    setTimeout(() => {
      updateNTPRecentVisits();
      if (ntpSearchInput) ntpSearchInput.focus();
    }, 0);
  } else if (tab.useBrowserView) {
    ntpPage.classList.remove('active');
    ipcRenderer.send('bv-show', { tabId: tab.id, bounds: getBrowserViewBounds() });
  } else if (tab.webview) {
    ntpPage.classList.remove('active');
    tab.webview.classList.add('active');
  }
  if (tab?.guestId) setGuestTabActive(tab, true);
}

function updateTabWidths() {
  const containerWidth = tabsBar.clientWidth - 50; // padding/newTabBtn
  const tabCount = tabs.length;
  if (tabCount === 0) return;

  const targetWidth = Math.max(30, Math.min(240, Math.floor(containerWidth / tabCount)));
  const hideTitles = targetWidth < 60;

  tabs.forEach(t => {
    t.element.style.width = targetWidth + 'px';
    t.element.classList.toggle('narrow-tab', hideTitles);
  });
}

function toggleMute(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;

  const nextMuted = !tab.isMuted;
  tab.isMuted = nextMuted;

  if (tab.useBrowserView) {
    ipcRenderer.send('bv-set-muted', { tabId: tab.id, muted: nextMuted });
  } else if (tab.webview) {
    try { tab.webview.setAudioMuted(nextMuted); } catch (e) { console.error('Audio Mute Error', e); }
  }

  const audioEl = tab.element.querySelector('.tab-audio');
  if (audioEl) {
    if (nextMuted) {
      audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      audioEl.classList.add('muted');
    } else {
      audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      audioEl.classList.remove('muted');
    }
    audioEl.style.display = 'flex';
  }
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const tab = tabs[idx];

  closedTabsStack.push({ url: tab.url, incognito: tab.incognito });
  if (closedTabsStack.length > 20) closedTabsStack.shift();

  tab._thumbnail = null;

  tabRecoverHandlers.delete(id);
  if (tab.useBrowserView) {
    ipcRenderer.send('bv-destroy', id);
  } else {
    detachWebviewTab(tab);
  }

  tab.element.remove();
  tabs.splice(idx, 1);

  if (tabs.length === 0) { createNewTab(); return; }
  if (activeTabId === id) switchTab(tabs[Math.max(0, idx - 1)].id);

  updateTabWidths();
}

function duplicateTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (tab) createNewTab(tab.url, tab.incognito);
}

function closeTabsToRight(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const toDelete = tabs.slice(idx + 1).map(t => t.id);
  toDelete.forEach(tid => closeTab(tid));
}

function closeOtherTabs(id) {
  const toDelete = tabs.filter(t => t.id !== id).map(t => t.id);
  toDelete.forEach(tid => closeTab(tid));
}

function closeAllTabs() {
  const allIds = tabs.map(t => t.id);
  for (let i = allIds.length - 1; i >= 0; i--) {
    closeTab(allIds[i]);
  }
}


function updateTabTitle(id, title) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (title && (title.startsWith('data:') || title.startsWith('about:blank'))) {
    title = (window.t ? window.t('tab-new', 'Новая вкладка') : 'Новая вкладка');
  }
  tab.title = title || (window.t ? window.t('tab-new', 'Новая вкладка') : 'Новая вкладка');
  const el = document.getElementById('title-' + id);
  if (el) el.textContent = tab.title;
}

function updateNavButtons() {
  refreshNavButtonsAsync();
}

const secSvg = {
  globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  warn: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  incognito: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  danger: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  verified: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`
};

function isGompTrustedDomain(url) {
  if (window.gompTrusted) {
    return window.gompTrusted.isGompTrustedDomain(url, settings?.trustedDomains || []);
  }
  return false;
}

function updateSecurityIcon(url, sslInvalid = false) {
  const tab = getActiveTab();
  const isSslForced = sslInvalid || (tab && tab.sslInvalid);

  secIcon.className = '';
  urlBar.classList.remove('ssl-strikethrough');
  urlBarWrap.classList.remove('incognito');

  if (isIncognito) {
    secIcon.innerHTML = secSvg.incognito;
    secIcon.classList.add('ssl-incognito');
    urlBarWrap.classList.add('incognito');
    return;
  }

  if (isSslForced) {
    secIcon.innerHTML = secSvg.danger;
    secIcon.classList.add('ssl-danger');
    urlBar.classList.add('ssl-strikethrough');
  } else if (isGompTrustedDomain(url)) {
    secIcon.innerHTML = secSvg.verified;
    secIcon.classList.add('ssl-verified');
  } else if (url.startsWith('https://')) {
    secIcon.innerHTML = secSvg.lock;
    secIcon.classList.add('ssl-secure');
  } else if (url.startsWith('http://')) {
    secIcon.innerHTML = secSvg.warn;
    secIcon.classList.add('ssl-warning');
  } else {
    secIcon.innerHTML = secSvg.globe;
  }
}

secIcon.addEventListener('click', async () => {
  const tab = getActiveTab();
  if (!tab) return;
  const url = getTabUrl(tab);
  if (!url) return;

  const overlay = document.getElementById('overlay-cert');
  const content = document.getElementById('cert-content');
  const title = document.getElementById('ssl-title');
  overlay.classList.add('show');
  
  const t = window.t || ((k, f) => f || k);
  const i = window.icon || ((n) => n);
  
  const domain = url.replace(/^https?:\/\//, '').split('/')[0];
  const gompTrusted = isGompTrustedDomain(url);
  
  if (!url.startsWith('https://')) {
    content.innerHTML = `
      <div style="padding: 28px 24px; text-align: center;">
        <div style="width: 56px; height: 56px; background: ${gompTrusted ? 'rgba(88,101,242,0.15)' : 'rgba(255,76,76,0.15)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          ${gompTrusted
            ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5865f2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`
            : i('unlock', 28, '#ff5555')}
        </div>
        <div style="color: ${gompTrusted ? '#5865f2' : 'var(--danger)'}; font-size: 16px; font-weight: 600; margin-bottom: 6px;">${gompTrusted ? t('ssl-gomp-title', 'Проект GOmp Studios') : t('ssl-unsecure', 'Insecure Connection')}</div>
        <div style="color: var(--text-muted); font-size: 13px; line-height: 1.5;">${gompTrusted ? t('ssl-gomp-desc', 'Официальный проект экосистемы GOmp Studios') : t('ssl-unencrypted-desc', 'Data is sent without encryption')}</div>
      </div>`;
    return;
  }

  content.innerHTML = `
    <div style="padding: 40px; text-align: center;">
      <div style="width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; margin: 0 auto 16px; animation: certspin 1s linear infinite;"></div>
      <style>@keyframes certspin{to{transform:rotate(360deg)}}</style>
      <div style="color: var(--text-muted); font-size: 13px;">${t('ssl-checking', 'Checking certificate...')}</div>
    </div>`;

  try {
    const cert = await ipcRenderer.invoke('get-certificate-info', url);
    if (!cert) throw new Error('No cert');

    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    const now = new Date();
    const totalDays = Math.ceil((validTo - validFrom) / (1000 * 60 * 60 * 24));
    const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
    const isExpired = daysUntilExpiry < 0;
    const isExpiringSoon = daysUntilExpiry < 30 && daysUntilExpiry >= 0;
    const progressPct = Math.max(0, Math.min(100, (daysUntilExpiry / totalDays) * 100));

    let statusColor = '#4caf50';
    let statusBg = 'rgba(76,175,80,0.12)';
    let statusSolid = '#132a1a';  // solid dark green background
    let statusText = t('ssl-secure', 'Secure Connection');

    const certIssuerOrg = String(cert.issuer?.O || cert.issuer?.organizationName || '');
    const certIssuerCN = String(cert.issuer?.CN || cert.issuer?.commonName || '');
    const isGompCert = gompTrusted || certIssuerOrg.toLowerCase().includes('gomp') || certIssuerCN.toLowerCase().includes('gomp');

    if (isGompCert) {
      statusColor = '#5865f2';
      statusBg = 'rgba(88,101,242,0.12)';
      statusSolid = '#151828';
      statusText = t('ssl-gomp-title', 'Проект GOmp Studios');
    }
    
    if (isExpired) {
      statusColor = '#ff4c4c';
      statusBg = 'rgba(255,76,76,0.12)';
      statusSolid = '#2a1313';
      statusText = t('ssl-expired', 'Certificate Expired');
    } else if (isExpiringSoon) {
      statusColor = '#ff9800';
      statusBg = 'rgba(255,152,0,0.12)';
      statusSolid = '#2a1f13';
      statusText = t('ssl-expiring', 'Certificate expiring soon');
    }

    content.innerHTML = `
      <div style="padding: 0;">
        <!-- Domain Header -->
        <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--border); background: ${statusSolid};">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 32px; height: 32px; background: ${statusColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${isGompCert && !isExpired && !isExpiringSoon
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
                : i('lock', 16, '#fff')}
            </div>
            <div>
              <div style="font-size: 11px; color: ${statusColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">${statusText}</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.2px;">${escHtml(domain)}</div>
              ${isGompCert ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">${t('ssl-gomp-desc', 'Официальный проект экосистемы GOmp Studios')}</div>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);">
            <span style="background: var(--bg-primary); padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">${cert.protocol}</span>
            <span>•</span>
            <span>${isExpired ? t('ssl-expired-days', 'Expired') : daysUntilExpiry + ' ' + t('ssl-days', 'days')}</span>
          </div>
        </div>

        <!-- Validity Bar -->
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
            <span>${validFrom.toLocaleDateString()}</span>
            <span>${validTo.toLocaleDateString()}</span>
          </div>
          <div style="height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden;">
            <div style="width: ${progressPct}%; height: 100%; background: ${isExpired ? '#ff4c4c' : isExpiringSoon ? '#ff9800' : '#4caf50'}; border-radius: 2px; transition: width 0.3s;"></div>
          </div>
          ${isExpiringSoon ? `<div style="font-size: 11px; color: #ff9800; margin-top: 6px; display:flex; align-items:center; gap:6px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${t('ssl-expiring-soon', 'Certificate expiring soon')}</div>` : ''}
        </div>

        <!-- Info Rows -->
        <div style="padding: 8px 0;">
          <div style="padding: 12px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
            ${i('user', 18, 'var(--text-muted)')}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${t('ssl-issued-to', 'Issued to')}</div>
              <div style="font-size: 14px; color: var(--text-primary); font-weight: 500; word-break: break-word;">${escHtml(cert.subject.CN || domain)}</div>
            </div>
          </div>
          <div style="padding: 12px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
            ${i('building', 18, 'var(--text-muted)')}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${t('ssl-issued-by', 'Issued by')}</div>
              <div style="font-size: 14px; color: var(--text-primary); font-weight: 500;">${escHtml(cert.issuer.CN || t('ssl-unknown', 'Unknown'))}</div>
            </div>
          </div>
          <div style="padding: 12px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
            ${i('key', 18, 'var(--text-muted)')}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${t('ssl-technical', 'Technical Details')}</div>
              <div style="font-size: 13px; color: var(--text-secondary);">${cert.protocol} • ${cert.subject?.keyAlg || 'RSA'}</div>
            </div>
          </div>
        </div>

        <!-- Fingerprint (Collapsible) -->
        <details style="border-bottom: 1px solid var(--border);">
          <summary style="padding: 14px 24px; cursor: pointer; font-size: 13px; color: var(--text-primary); display: flex; align-items: center; gap: 12px; user-select: none; list-style: none;">
            ${i('fingerprint', 18, 'var(--text-muted)')}
            <span style="flex: 1;">${t('ssl-fingerprint', 'SHA-256 Fingerprint')}</span>
            <span style="color: var(--accent); font-size: 11px;">▼</span>
          </summary>
          <div style="padding: 0 24px 16px;">
            <code style="display: block; font-size: 10px; color: var(--text-secondary); background: var(--bg-primary); padding: 10px; border-radius: 6px; word-break: break-all; font-family: 'JetBrains Mono', monospace; border: 1px solid var(--border); line-height: 1.5; margin-bottom: 10px;">${cert.fingerprint}</code>
            <button id="btn-copy-fp" style="width: 100%; padding: 8px; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              ${i('copy', 14)} ${t('ssl-copy-fingerprint', 'Copy fingerprint')}
            </button>
          </div>
        </details>
      </div>
    `;
    
    document.getElementById('btn-copy-fp')?.addEventListener('click', (e) => {
      navigator.clipboard.writeText(cert.fingerprint);
      const btn = e.currentTarget;
      btn.innerHTML = `${i('check', 14)} ${t('ssl-copied', 'Fingerprint copied')}`;
      btn.style.background = 'rgba(76,175,80,0.2)';
      btn.style.borderColor = '#4caf50';
      btn.style.color = '#4caf50';
      setTimeout(() => {
        btn.innerHTML = `${i('copy', 14)} ${t('ssl-copy-fingerprint', 'Copy fingerprint')}`;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 2000);
    });
    
  } catch (e) {
    console.error('Certificate error:', e);
    content.innerHTML = `
      <div style="padding: 28px 24px; text-align: center;">
        <div style="width: 56px; height: 56px; background: rgba(255,76,76,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          ${i('shieldX', 28, '#ff5555')}
        </div>
        <div style="color: var(--danger); font-size: 16px; font-weight: 600; margin-bottom: 6px;">${t('ssl-fail-title', 'Failed to get certificate info')}</div>
        <div style="color: var(--text-muted); font-size: 13px;">${t('ssl-fail-desc', 'The site may use a self-signed certificate or there are connection issues.')}</div>
      </div>`;
  }
});

function closeCert() {
  const el = document.getElementById('overlay-cert');
  if (window.closeOverlayAnimated) window.closeOverlayAnimated(el);
  else el?.classList.remove('show');
}
document.getElementById('btn-close-cert').addEventListener('click', closeCert);
document.getElementById('overlay-cert').addEventListener('click', e => { if (e.target === e.currentTarget) closeCert(); });

function navigate(url) {
  const resolved = resolveUrl(url);
  if (!resolved) return;
  const tab = getActiveTab();
  if (!tab) return;

  if (isVoiceUrl(resolved)) {
    if (tab.isNewTabPage) {
      ntpPage.classList.remove('active');
      tab.isNewTabPage = false;
    }
    tab.url = resolved;
    if (tab.useBrowserView) {
      ipcRenderer.invoke('bv-load', { tabId: tab.id, url: resolved });
      ipcRenderer.send('bv-show', { tabId: tab.id, bounds: getBrowserViewBounds() });
    } else {
      migrateTabToBrowserView(tab, resolved);
    }
    return;
  }

  if (tab.isNewTabPage) {
    ntpPage.classList.remove('active');
    if (tab.webview) tab.webview.classList.add('active');
    tab.isNewTabPage = false;
  }
  if (tab.useBrowserView) {
    ipcRenderer.send('bv-hide-all');
    if (!tab.webview) {
      tab.useBrowserView = false;
      tab.voiceMode = false;
      tab.element.classList.remove('voice-tab');
      ipcRenderer.send('bv-destroy', tab.id);
      attachWebviewToTab(tab);
    }
  } else if (!tab.webview) {
    attachWebviewToTab(tab);
  }
  if (tab.webview) {
    tab.webview.classList.add('active');
    try {
      if (typeof tab.webview.loadURL === 'function') {
        tab.webview.loadURL(resolved).catch(err => {
          console.warn('[Webview] Navigation error:', err.message);
        });
      } else {
        tab.webview.src = resolved;
      }
    } catch (_) {
      try { tab.webview.src = resolved; } catch (__) {}
    }
  }
}

if (ntpSearchInput) {
  ntpSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      navigate(e.target.value.trim());
      e.target.value = '';
    }
  });
}

document.querySelectorAll('.ntp-shortcut').forEach(el => {
  el.addEventListener('click', () => {
    if (el.dataset.url) navigate(el.dataset.url);
  });
});

urlBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate(urlBar.value); urlBar.blur(); }
  else if (e.key === 'Escape') {
    const tab = getActiveTab();
    if (tab) urlBar.value = getTabUrl(tab);
    urlBar.blur();
  }
});
urlBar.addEventListener('focus', () => urlBar.select());

function setZoom(factor) {
  currentZoom = Math.min(3, Math.max(0.25, factor));
  const tab = getActiveTab();
  if (tab && tab.webview) {
    try { tab.webview.setZoomFactor(currentZoom); } catch (e) { }
    tab.zoom = currentZoom;
  }
  updateZoomUI();
  ipcRenderer.send('set-zoom', currentZoom);
}

document.getElementById('btn-zoom-in').addEventListener('click', () => setZoom(+(currentZoom + 0.1).toFixed(2)));
document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(+(currentZoom - 0.1).toFixed(2)));
zoomDisplay.addEventListener('click', () => setZoom(1.0));

function updateBookmarkBtn(url) {
  if (!url) return;
  ipcRenderer.send('is-bookmarked', url);
}

const bookmarkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const bookmarkFilledIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

ipcRenderer.on('bookmark-status', (e, isBookmarked) => {
  const btn = document.getElementById('btn-bookmark');
  btn.innerHTML = isBookmarked ? bookmarkFilledIcon : bookmarkIcon;
  btn.style.color = isBookmarked ? 'var(--accent)' : '';
  btn.style.fill = isBookmarked ? 'var(--accent)' : 'none';
});

document.getElementById('btn-bookmark').addEventListener('click', () => {
  const tab = getActiveTab();
  if (!tab) return;
  const url = getTabUrl(tab);
  if (!url) return;

  const btn = document.getElementById('btn-bookmark');
  const t = window.t || ((k, f) => f || k);
  const isBookmarked = btn.style.color === 'var(--accent)';
  
  if (isBookmarked) {
    ipcRenderer.send('remove-bookmark', url);
    btn.innerHTML = bookmarkIcon;
    btn.style.color = '';
    btn.style.fill = 'none';
    toast(t('toast-bookmark-removed', 'Закладка удалена'));
  } else {
    ipcRenderer.send('add-bookmark', { url, title: tab.title, favicon: tab.favicon || '' });
    btn.innerHTML = bookmarkFilledIcon;
    btn.style.color = 'var(--accent)';
    btn.style.fill = 'var(--accent)';
    toast(t('toast-bookmark-added', 'Добавлено в закладки'));
  }
});

ipcRenderer.on('bookmarks-data', (e, bms) => {
  bookmarksCache = bms || [];
  renderBookmarksBar(bookmarksCache);
  renderBookmarksSidebar(bookmarksCache);
});

function bookmarkFaviconHtml(bm, size = 14) {
  if (bm.favicon) {
    return `<img src="${escAttr(bm.favicon)}" width="${size}" height="${size}" style="object-fit:contain" onerror="this.outerHTML='${uiSvg.star.replace(/"/g, '&quot;')}'">`;
  }
  return uiSvg.star;
}

function attachBookmarkItemEvents(el, bm) {
  el.title = bm.url;
  el.addEventListener('click', (e) => {
    if (e.button === 0) navigate(bm.url);
  });
  el.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      createNewTab(bm.url, isIncognito);
    }
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showBookmarkContextMenu(e.clientX, e.clientY, bm);
  });
}

function showBookmarkContextMenu(x, y, bm) {
  const t = window.t || ((k, f) => f || k);
  bmCtxMenu.innerHTML = `
    <button class="bm-ctx-item" data-action="open">${t('bm-ctx-open', 'Открыть')}</button>
    <button class="bm-ctx-item" data-action="new-tab">${t('bm-ctx-new-tab', 'Открыть в новой вкладке')}</button>
    <div class="bm-ctx-sep"></div>
    <button class="bm-ctx-item" data-action="copy">${t('bm-ctx-copy', 'Копировать ссылку')}</button>
    <div class="bm-ctx-sep"></div>
    <button class="bm-ctx-item danger" data-action="delete">${t('bm-ctx-delete', 'Удалить закладку')}</button>
  `;
  bmCtxMenu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  bmCtxMenu.style.top = Math.min(y, window.innerHeight - 180) + 'px';
  bmCtxMenu.classList.add('show');
  bmCtxMenu.querySelectorAll('.bm-ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'open') navigate(bm.url);
      else if (action === 'new-tab') createNewTab(bm.url, isIncognito);
      else if (action === 'copy') {
        navigator.clipboard.writeText(bm.url);
        toast(t('toast-url-copied', 'Ссылка скопирована'));
      }
      else if (action === 'delete') removeBookmark(bm.url);
      hideBookmarkContextMenu();
    });
  });
}

function hideBookmarkContextMenu() {
  bmCtxMenu.classList.remove('show');
  setTimeout(() => { if (!bmCtxMenu.classList.contains('show')) bmCtxMenu.innerHTML = ''; }, 200);
}
document.addEventListener('click', hideBookmarkContextMenu);
document.addEventListener('scroll', hideBookmarkContextMenu, true);

function renderBookmarksBar(bms) {
  if (!bookmarksScroll) return;
  bookmarksScroll.innerHTML = '';
  const list = (bms || []).slice(0, 40);
  if (!list.length) {
    const hint = document.createElement('div');
    hint.className = 'bookmarks-empty-hint';
    const t = window.t || ((k, f) => f || k);
    hint.innerHTML = t('bookmarks-empty-hint', 'Нет закладок — нажмите <kbd>Ctrl+D</kbd> или кнопку + слева');
    bookmarksScroll.appendChild(hint);
    return;
  }
  list.forEach(bm => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bookmark-item';
    el.innerHTML = `<span class="bookmark-favicon">${bookmarkFaviconHtml(bm)}</span><span class="bookmark-label">${escHtml((bm.title || bm.url).slice(0, 28))}</span>`;
    attachBookmarkItemEvents(el, bm);
    bookmarksScroll.appendChild(el);
  });
}

let bookmarksFullFiltered = [];
let bookmarksRenderedCount = 0;
const BOOKMARKS_PAGE_SIZE = 40;

function renderBookmarkItemHtml(bm) {
  const safeSrc = escAttr(bm.url);
  const t = window.t || ((k, f) => f || k);
  return `<div class="bm-item" data-url="${safeSrc}">
    <div class="bm-item-icon">${bookmarkFaviconHtml(bm, 16)}</div>
    <div style="flex:1;min-width:0;" class="bm-item-body">
      <div class="bm-title">${escHtml(bm.title || bm.url)}</div>
      <div class="bm-url">${escHtml(bm.url)}</div>
    </div>
    <button class="bm-remove" title="${t('btn-delete-tooltip', 'Delete')}">${uiSvg.close}</button>
  </div>`;
}

function bindBookmarkItemEvents(container) {
  container.querySelectorAll('.bm-item:not([data-events-bound])').forEach(row => {
    row.setAttribute('data-events-bound', '1');
    const url = row.dataset.url;
    const bm = (bookmarksCache || []).find(b => b.url === url);
    if (!bm) return;
    row.querySelector('.bm-item-body')?.addEventListener('click', () => navigateTo(url));
    row.querySelector('.bm-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBookmark(url);
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showBookmarkContextMenu(e.clientX, e.clientY, bm);
    });
    row.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        createNewTab(url, isIncognito);
      }
    });
  });
}

function appendBookmarksChunk() {
  if (bookmarksRenderedCount >= bookmarksFullFiltered.length) return;
  const nextChunk = bookmarksFullFiltered.slice(bookmarksRenderedCount, bookmarksRenderedCount + BOOKMARKS_PAGE_SIZE);
  if (!nextChunk.length) return;
  bookmarksRenderedCount += nextChunk.length;

  let group = bookmarksList.querySelector('.ios-list-group');
  if (!group) {
    group = document.createElement('div');
    group.className = 'ios-list-group';
    bookmarksList.appendChild(group);
  }
  const temp = document.createElement('div');
  temp.innerHTML = nextChunk.map(renderBookmarkItemHtml).join('');
  while (temp.firstChild) {
    group.appendChild(temp.firstChild);
  }
  bindBookmarkItemEvents(group);
}

bookmarksList?.addEventListener('scroll', () => {
  if (bookmarksList.scrollTop + bookmarksList.clientHeight >= bookmarksList.scrollHeight - 120) {
    appendBookmarksChunk();
  }
});

function renderBookmarksSidebar(bms) {
  const q = (bookmarksSearch?.value || '').trim().toLowerCase();
  let filtered = bms || [];
  if (q) {
    filtered = filtered.filter(bm =>
      (bm.title || '').toLowerCase().includes(q) ||
      (bm.url || '').toLowerCase().includes(q)
    );
  }
  bookmarksFullFiltered = filtered;
  bookmarksRenderedCount = 0;

  const countEl = document.getElementById('bookmarks-count-label');
  const t = window.t || ((k, f) => f || k);
  if (countEl) {
    countEl.textContent = q
      ? t('bookmarks-count-filtered', '{n} из {total}').replace('{n}', filtered.length).replace('{total}', (bms || []).length)
      : t('bookmarks-count', '{n} закладок').replace('{n}', (bms || []).length);
  }
  if (!filtered.length) {
    bookmarksList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${uiSvg.star}</div><div class="empty-state-text">${q ? (t('nothing-found', 'Nothing found')) : (t('empty-bookmarks', 'No bookmarks'))}</div></div>`;
    return;
  }

  const initialChunk = filtered.slice(0, BOOKMARKS_PAGE_SIZE);
  bookmarksRenderedCount = initialChunk.length;
  bookmarksList.innerHTML = `<div class="ios-list-group">${initialChunk.map(renderBookmarkItemHtml).join('')}</div>`;
  bindBookmarkItemEvents(bookmarksList);
}

function removeBookmark(url) {
  const t = window.t || ((k, f) => f || k);
  ipcRenderer.send('remove-bookmark', url);
  toast(t('toast-bookmark-removed', 'Закладка удалена'));
  
  const tab = getActiveTab();
  if (tab) {
    const currentUrl = getTabUrl(tab);
    if (currentUrl === url) updateBookmarkBtn(url);
  }
}

let historyFullCache = [];
let historyRenderedCount = 0;
const HISTORY_PAGE_SIZE = 40;

ipcRenderer.on('history-data', (e, history) => {
  historyFullCache = (history || []).filter(item => !item.url.startsWith('data:'));
  renderHistoryInitial();
});

function renderHistoryItemHtml(item) {
  const su = escAttr(item.url);
  return `<div class="history-item" data-url="${su}">
    <div class="hi-icon">${uiSvg.globe}</div>
    <div class="hi-content">
      <div class="hi-title">${escHtml(item.title || item.url)}</div>
      <div class="hi-url">${escHtml(item.url)}</div>
      <div class="hi-time" style="display:flex; align-items:center; gap:6px;">${uiSvg.clock} ${escHtml(item.displayTime || '')}</div>
    </div>
    <button class="hi-delete" title="Удалить">${uiSvg.trash}</button>
  </div>`;
}

function renderHistoryInitial() {
  historyRenderedCount = 0;
  if (!historyFullCache.length) {
    historyList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${uiSvg.book}</div><div class="empty-state-text">${historySearch.value ? (window.t ? window.t('nothing-found', 'Nothing found') : 'Nothing found') : (window.t ? window.t('empty-history', 'History is empty') : 'History is empty')}</div></div>`;
    return;
  }
  const chunk = historyFullCache.slice(0, HISTORY_PAGE_SIZE);
  historyRenderedCount = chunk.length;
  historyList.innerHTML = `<div class="ios-list-group">${chunk.map(renderHistoryItemHtml).join('')}</div>`;
}

function appendHistoryChunk() {
  if (historyRenderedCount >= historyFullCache.length) return;
  const nextChunk = historyFullCache.slice(historyRenderedCount, historyRenderedCount + HISTORY_PAGE_SIZE);
  if (!nextChunk.length) return;
  historyRenderedCount += nextChunk.length;

  let group = historyList.querySelector('.ios-list-group');
  if (!group) {
    group = document.createElement('div');
    group.className = 'ios-list-group';
    historyList.appendChild(group);
  }
  const temp = document.createElement('div');
  temp.innerHTML = nextChunk.map(renderHistoryItemHtml).join('');
  while (temp.firstChild) {
    group.appendChild(temp.firstChild);
  }
}

historyList?.addEventListener('click', (e) => {
  const delBtn = e.target.closest('.hi-delete');
  if (delBtn) {
    e.stopPropagation();
    const itemEl = delBtn.closest('.history-item');
    const url = itemEl?.dataset.url;
    if (url) {
      deleteHistoryItem(url);
      itemEl.remove();
    }
    return;
  }
  const content = e.target.closest('.hi-content');
  if (content) {
    const itemEl = content.closest('.history-item');
    const url = itemEl?.dataset.url;
    if (url) navigateTo(url);
  }
});

historyList?.addEventListener('scroll', () => {
  if (historyList.scrollTop + historyList.clientHeight >= historyList.scrollHeight - 120) {
    appendHistoryChunk();
  }
});

function navigateTo(url) { navigate(url); if (window.iosUI) window.iosUI.closeSidebar(); }

function openBookmarksSidebar() {
  if (window.iosUI) window.iosUI.openSidebar('bookmarks');
}

document.getElementById('btn-bookmarks-all')?.addEventListener('click', openBookmarksSidebar);
document.getElementById('btn-bookmarks-add')?.addEventListener('click', () => {
  document.getElementById('btn-bookmark')?.click();
});

document.getElementById('btn-close-sidebar')?.addEventListener('click', () => {
  if (window.iosUI) window.iosUI.closeSidebar();
});

let bmSearchTimer;
bookmarksSearch?.addEventListener('input', () => {
  clearTimeout(bmSearchTimer);
  bmSearchTimer = setTimeout(() => renderBookmarksSidebar(bookmarksCache), 200);
});

function toggleBookmarksBar() {
  const show = bookmarksBar.classList.contains('hidden');
  applyShowBookmarksBar(show);
  ipcRenderer.send('patch-setting', { showBookmarksBar: show });
}

function deleteHistoryItem(url) { ipcRenderer.send('delete-history-item', url); }

let histSearchTimer;
historySearch.addEventListener('input', e => {
  clearTimeout(histSearchTimer);
  histSearchTimer = setTimeout(() => {
    const q = e.target.value.trim();
    if (q) ipcRenderer.send('search-history', q);
    else ipcRenderer.send('get-history');
  }, 250);
});

ipcRenderer.on('history-cleared', () => {
  const t = window.t || ((k, f) => f || k);
  historySearch.value = '';
  ipcRenderer.send('get-history');
  toast(t('toast-history-cleared', 'История очищена'));
});

document.getElementById('btn-clear-history')?.addEventListener('click', () => {
  if (confirm(window.t ? window.t('confirm-clear-history', 'Очистить всю историю?') : 'Очистить всю историю?')) {
    ipcRenderer.send('clear-history');
  }
});

document.getElementById('btn-sidebar').addEventListener('click', () => {
  if (window.iosUI) window.iosUI.toggleSidebar();
});

document.getElementById('btn-incognito').addEventListener('click', () => {
  const t = window.t || ((k, f) => f || k);
  ipcRenderer.send('open-incognito-window');
  toast(t('toast-incognito-open', 'Открывается окно инкогнито...'));
});

let downloadsClickOutsideHandler = null;

function toggleDownloads() {
  const extDrop = document.getElementById('extensions-dropdown');
  if (extDrop) extDrop.classList.remove('show');
  
  const open = downloadsPanel.classList.toggle('open');
  const btn = document.getElementById('btn-downloads');
  if (btn) btn.classList.toggle('active', open);

  if (open) {
    if (downloadsClickOutsideHandler) document.removeEventListener('click', downloadsClickOutsideHandler);
    downloadsClickOutsideHandler = (e) => {
      if (!downloadsPanel.contains(e.target) && (!btn || !btn.contains(e.target))) {
        downloadsPanel.classList.remove('open');
        if (btn) btn.classList.remove('active');
        document.removeEventListener('click', downloadsClickOutsideHandler);
        downloadsClickOutsideHandler = null;
      }
    };
    setTimeout(() => document.addEventListener('click', downloadsClickOutsideHandler), 10);
  } else if (downloadsClickOutsideHandler) {
    document.removeEventListener('click', downloadsClickOutsideHandler);
    downloadsClickOutsideHandler = null;
  }
}

document.getElementById('btn-downloads').addEventListener('click', toggleDownloads);
document.getElementById('btn-close-downloads').addEventListener('click', () => {
  downloadsPanel.classList.remove('open');
  const btn = document.getElementById('btn-downloads');
  if (btn) btn.classList.remove('active');
  if (downloadsClickOutsideHandler) {
    document.removeEventListener('click', downloadsClickOutsideHandler);
    downloadsClickOutsideHandler = null;
  }
});

ipcRenderer.send('setup-download-listener');

ipcRenderer.on('download-started', (e, dl) => {
  downloads[dl.id] = { ...dl, receivedBytes: 0, speed: 0, paused: false, state: 'progressing' };
  renderDownloads();
  if (!downloadsPanel.classList.contains('open')) toggleDownloads();
  const t = window.t || ((k, f) => f || k);
  toast(`${t('toast-download-start', 'Загрузка: ')}${dl.filename}`);
});

ipcRenderer.on('download-progress', (e, { id, receivedBytes, totalBytes, speed, paused }) => {
  if (downloads[id]) {
    downloads[id].receivedBytes = receivedBytes;
    downloads[id].totalBytes = totalBytes;
    downloads[id].speed = speed || 0;
    downloads[id].paused = !!paused;
    if (!paused) downloads[id].state = 'progressing';
    renderDownloads();
  }
});

ipcRenderer.on('download-state', (e, { id, state }) => {
  if (!downloads[id]) return;
  downloads[id].state = state;
  downloads[id].paused = state === 'paused';
  if (state === 'progressing') downloads[id].paused = false;
  renderDownloads();
});

ipcRenderer.on('download-done', (e, { id, state, savePath, filename, checksum }) => {
  if (downloads[id]) {
    downloads[id].state = state;
    downloads[id].savePath = savePath;
    downloads[id].checksum = checksum || null;
    downloads[id].paused = false;
    downloads[id].speed = 0;
    renderDownloads();
    const t = window.t || ((k, f) => f || k);
    if (state === 'completed') toast(`${t('toast-download-complete', 'Загружено: ')}${filename}`);
    else if (state === 'cancelled') toast(`${t('toast-download-cancelled', 'Отменено: ')}${filename}`);
  }
});

function renderDownloads() {
  const ids = Object.keys(downloads).reverse();
  if (!ids.length) {
    const t = window.t || ((k, f) => f || k);
    dlList.innerHTML = `<div class="empty-state" style="padding:50px 20px;">
      <div class="empty-state-icon" style="opacity:0.2;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
      <div class="empty-state-text">${t('dl-empty', 'Нет загрузок')}</div>
      <div style="font-size:11px; color:var(--text-muted); opacity:0.5; margin-top:4px;">${t('dl-empty-hint', 'Загруженные файлы появятся здесь')}</div>
    </div>`;
    return;
  }

  if (dlList.querySelector('.empty-state')) {
    dlList.innerHTML = '';
  }

  const existingEls = {};
  dlList.querySelectorAll('.dl-item[data-dl-item-id]').forEach(el => {
    existingEls[el.dataset.dlItemId] = el;
  });

  const t = window.t || ((k, f) => f || k);

  ids.forEach(id => {
    const dl = downloads[id];
    const pct = dl.totalBytes > 0 ? Math.round(dl.receivedBytes / dl.totalBytes * 100) : 0;
    const done = dl.state === 'completed';
    const cancelled = dl.state === 'cancelled';
    const paused = dl.state === 'paused' || dl.paused;
    const interrupted = dl.state === 'interrupted';
    
    let etaStr = '';
    if (!done && !cancelled && !paused && dl.speed > 0 && dl.totalBytes > 0) {
      const sec = Math.max(0, Math.floor((dl.totalBytes - dl.receivedBytes) / dl.speed));
      if (sec < 60) etaStr = ` · ${t('dl-eta-sec', 'ост.')} ${sec} ${t('dl-sec', 'сек.')}`;
      else if (sec < 3600) etaStr = ` · ${t('dl-eta-min', 'ост.')} ${Math.floor(sec/60)} ${t('dl-min', 'мин.')}`;
      else etaStr = ` · ${t('dl-eta-hr', 'ост.')} ${Math.floor(sec/3600)} ${t('dl-hr', 'ч.')}`;
    }

    const speedStr = (!done && !cancelled && !paused && dl.speed > 0) ? ` · ${formatSpeed(dl.speed)}` : '';
    const baseProgress = `${pct}% · ${formatBytes(dl.receivedBytes)} / ${formatBytes(dl.totalBytes)}${speedStr}${etaStr}`;
    const statusText = done
      ? t('dl-completed', 'Завершено')
      : cancelled
        ? t('dl-cancelled', 'Отменено')
        : paused
          ? t('dl-paused', 'Приостановлено')
          : interrupted
            ? t('dl-interrupted', 'Прервано')
            : baseProgress;

    const existingEl = existingEls[id];
    if (existingEl && existingEl.dataset.dlState === dl.state) {
      const statusEl = existingEl.querySelector('.dl-status');
      const progressFillEl = existingEl.querySelector('.dl-progress-fill');
      if (statusEl) statusEl.textContent = statusText;
      if (progressFillEl) progressFillEl.style.width = pct + '%';
      delete existingEls[id];
      return;
    }

    const icon = getFileIcon(dl.extension);
    let actions = '';
    if (done) {
      actions = `
      <button class="dl-action-btn" data-dl-action="open" data-dl-path="${escAttr(dl.savePath)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${t('dl-open', 'Открыть')}
      </button>
      <button class="dl-action-btn" data-dl-action="folder" data-dl-path="${escAttr(dl.savePath)}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${t('dl-folder', 'В папке')}
      </button>
      <button class="dl-action-btn" data-dl-action="retry" data-dl-url="${escAttr(dl.url || '')}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        ${t('dl-retry', 'Повторить')}
      </button>`;
    } else if (cancelled || interrupted) {
      actions = `
      <button class="dl-action-btn" data-dl-action="retry" data-dl-url="${escAttr(dl.url || '')}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        ${t('dl-retry', 'Повторить')}
      </button>`;
    } else {
      actions = paused
        ? `<button class="dl-action-btn" data-dl-action="resume" data-dl-id="${escAttr(id)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            ${t('dl-resume', 'Продолжить')}
           </button>
           <button class="dl-action-btn" data-dl-action="cancel" data-dl-id="${escAttr(id)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ${t('dl-cancel', 'Отменить')}
           </button>`
        : `<button class="dl-action-btn" data-dl-action="pause" data-dl-id="${escAttr(id)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ${t('dl-pause', 'Пауза')}
           </button>
           <button class="dl-action-btn" data-dl-action="cancel" data-dl-id="${escAttr(id)}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ${t('dl-cancel', 'Отменить')}
           </button>`;
    }

    const checksumHtml = done && dl.checksum
      ? `<button class="dl-sha256-badge" data-dl-action="copy-sha256" data-dl-checksum="${escAttr(dl.checksum)}" title="Нажмите, чтобы скопировать SHA-256">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
           <span>SHA-256</span>
         </button>`
      : '';

    const itemHtml = `<div class="dl-item new-item" data-dl-item-id="${id}" data-dl-state="${dl.state}">
      <div class="dl-item-header">
        <div class="dl-icon">${icon}</div>
        <div class="dl-info">
          <div class="dl-filename" title="${escAttr(dl.filename)}">${escHtml(dl.filename)}</div>
          <div class="dl-status">${escHtml(statusText)}</div>
          ${checksumHtml}
        </div>
      </div>
      ${!done && !cancelled ? `<div class="dl-progress-bar"><div class="dl-progress-fill" style="width:${pct}%"></div></div>` : ''}
      ${actions ? `<div class="dl-actions">${actions}</div>` : ''}
    </div>`;

    if (existingEl) {
      existingEl.outerHTML = itemHtml;
    } else {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = itemHtml;
      dlList.appendChild(wrapper.firstElementChild);
    }
  });

  Object.values(existingEls).forEach(el => el.remove());
}

dlList.addEventListener('click', e => {
  const btn = e.target.closest('[data-dl-action]');
  if (!btn) return;
  const action = btn.dataset.dlAction;
  const filePath = btn.dataset.dlPath;
  const dlId = btn.dataset.dlId;
  const url = btn.dataset.dlUrl;
  const checksum = btn.dataset.dlChecksum;

  if (action === 'open' && filePath) ipcRenderer.send('open-file', filePath);
  else if (action === 'folder' && filePath) ipcRenderer.send('show-in-folder', filePath);
  else if (action === 'pause' && dlId) ipcRenderer.send('download-pause', dlId);
  else if (action === 'resume' && dlId) ipcRenderer.send('download-resume', dlId);
  else if (action === 'cancel' && dlId) ipcRenderer.send('download-cancel', dlId);
  else if (action === 'retry' && url) ipcRenderer.send('download-retry', url);
  else if (action === 'copy-sha256' && checksum) {
    navigator.clipboard.writeText(checksum);
    toast('SHA-256 скопирован в буфер обмена');
  }
});

async function openSettings() { 
  ipcRenderer.send('get-settings'); 
  document.getElementById('overlay-settings').classList.add('show');
  requestAnimationFrame(() => {
    if (window.iosUI) {
      window.iosUI.initSettingGroups();
      window.iosUI.refreshAllIndicators();
      window.iosUI.refreshSettingsAnimations();
    }
  });
  try {
    const ver = await ipcRenderer.invoke('get-app-version');
    const badge = document.getElementById('settings-version-badge');
    const footerVer = document.getElementById('settings-footer-version');
    if (badge) badge.textContent = 'v' + ver;
    if (footerVer) footerVer.textContent = 'v' + ver;
  } catch (e) {}
}
function closeSettings() {
  const el = document.getElementById('overlay-settings');
  if (window.closeOverlayAnimated) window.closeOverlayAnimated(el);
  else el?.classList.remove('show');
}

function applyTheme(themeName) {
  document.body.classList.remove('theme-light', 'theme-dracula', 'theme-hacker', 'theme-gomp', 'theme-dark');
  if (themeName && themeName !== 'dark') {
    document.body.classList.add('theme-' + themeName);
  }
}

const permPopup = document.getElementById('permission-popup');
const permQueue = [];
let permActive = false;

const permMeta = () => {
  const t = window.t || ((k, f) => f || k);
  return {
  'media': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    color: 'rgba(239,68,68,0.8)',
    title: t('set-permissions-camera', 'Camera & Microphone'),
    desc: t('perm-media-desc', 'Site wants access to your camera and microphone')
  },
  'geolocation': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    color: 'rgba(59,130,246,0.8)',
    title: t('set-permissions-geo', 'Geolocation'),
    desc: t('perm-geo-desc', 'Site wants to know your location')
  },
  'notifications': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    color: 'rgba(245,158,11,0.8)',
    title: t('set-permissions-notif', 'Notifications'),
    desc: t('perm-notif-desc', 'Site wants to send you notifications')
  },
  'display-capture': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    color: 'rgba(139,92,246,0.8)',
    title: t('set-permissions-screenshare', 'Screen Sharing'),
    desc: t('perm-display-desc', 'Site wants to share your screen')
  },
  'mediaKeySystem': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    color: 'rgba(16,185,129,0.8)',
    title: 'DRM',
    desc: t('perm-drm-desc', 'Site wants to play protected content')
  },
  'midi': {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    color: 'rgba(236,72,153,0.8)',
    title: 'MIDI',
    desc: t('perm-midi-desc', 'Site wants access to MIDI devices')
  }
};
};

function showPermPopup(data) {
  permQueue.push(data);
  if (!permActive) processPermQueue();
}

function positionPermPopup() {
  if (!permPopup || !secIcon) return;
  const iconRect = secIcon.getBoundingClientRect();
  const top = Math.round(iconRect.bottom + 8);
  const left = Math.max(8, Math.round(iconRect.left));
  const maxLeft = window.innerWidth - 360;
  permPopup.style.top = `${top}px`;
  permPopup.style.left = `${Math.min(left, maxLeft)}px`;
  permPopup.style.transformOrigin = `${Math.round(iconRect.width / 2)}px 0px`;
}

function setPageLayerForPerm(hidden) {
  document.querySelectorAll('webview').forEach(wv => {
    if (hidden) {
      if (wv.classList.contains('active')) {
        wv.dataset.permPassthrough = '1';
        wv.style.pointerEvents = 'none';
      }
    } else if (wv.dataset.permPassthrough) {
      wv.style.pointerEvents = '';
      delete wv.dataset.permPassthrough;
    }
  });
}

function pulsePermIcon() {
  if (!secIcon) return;
  secIcon.classList.remove('perm-pulse');
  void secIcon.offsetWidth;
  secIcon.classList.add('perm-pulse');
  setTimeout(() => secIcon.classList.remove('perm-pulse'), 700);
}

function playPermOpenAnimation() {
  if (!permPopup) return;
  permPopup.classList.remove('show', 'closing');
  requestAnimationFrame(() => {
    positionPermPopup();
    pulsePermIcon();
    requestAnimationFrame(() => permPopup.classList.add('show'));
  });
}

function closePermPopup(id, granted) {
  if (!permPopup) return;
  permPopup.classList.remove('show');
  permPopup.classList.add('closing');
  setTimeout(() => {
    ipcRenderer.send('permission-response', { id, granted });
    permPopup.classList.remove('closing');
    permPopup.innerHTML = '';
    permPopup.style.top = '';
    permPopup.style.left = '';
    permPopup.style.transformOrigin = '';
    setPageLayerForPerm(false);
    setTimeout(processPermQueue, 60);
  }, 300);
}

function processPermQueue() {
  if (!permQueue.length) {
    permActive = false;
    permPopup.classList.remove('show', 'closing');
    permPopup.innerHTML = '';
    setPageLayerForPerm(false);
    return;
  }
  permActive = true;
  const { id, permission, origin } = permQueue.shift();
  const t = window.t || ((k, f) => f || k);
  const metaMap = permMeta();
  const meta = metaMap[permission] || {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    color: 'rgba(107,114,128,0.8)',
    title: permission,
    desc: t('perm-generic-desc', 'Site is requesting permission')
  };

  permPopup.innerHTML = `
    <div class="perm-header">
      <div class="perm-icon-circle" style="background:${meta.color};">${meta.icon}</div>
      <div class="perm-header-text">
        <div class="perm-title">${meta.title}</div>
        <div class="perm-origin">${origin || t('perm-unknown-origin', 'unknown site')}</div>
      </div>
    </div>
    <div class="perm-desc">${meta.desc}</div>
    <div class="perm-actions">
      <button class="perm-btn perm-btn-deny" id="perm-deny">${t('perm-deny', 'Block')}</button>
      <button class="perm-btn perm-btn-allow" id="perm-allow">${t('perm-allow', 'Allow')}</button>
    </div>
  `;

  setPageLayerForPerm(true);
  playPermOpenAnimation();

  let responded = false;
  const respond = (granted) => {
    if (responded) return;
    if (!permPopup.classList.contains('show') && !permPopup.classList.contains('closing')) return;
    responded = true;
    closePermPopup(id, granted);
  };

  document.getElementById('perm-allow').addEventListener('click', () => respond(true));
  document.getElementById('perm-deny').addEventListener('click', () => respond(false));

  setTimeout(() => {
    if (permActive && permPopup.classList.contains('show')) {
      respond(false);
    }
  }, 30000);
}

ipcRenderer.on('permission-request', (e, data) => showPermPopup(data));

document.addEventListener('click', (e) => {
  if (permActive && permPopup.classList.contains('show') &&
      !permPopup.classList.contains('closing') &&
      !permPopup.contains(e.target)) {
    const denyBtn = document.getElementById('perm-deny');
    if (denyBtn) denyBtn.click();
  }
});

document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
document.getElementById('btn-settings-cancel').addEventListener('click', closeSettings);
document.getElementById('overlay-settings').addEventListener('click', e => { if (e.target === e.currentTarget) closeSettings(); });

document.getElementById('set-default-browser').addEventListener('click', async () => {
  const t = window.t || ((k, f) => f || k);
  const success = await ipcRenderer.invoke('set-as-default-browser');
  if (success) {
    toast(t('toast-default-browser-success', 'Протоколы зарегистрированы. Теперь выберите Visibility в настройках Windows'));
  } else {
    toast(t('toast-default-browser-fail', 'Ошибка регистрации'));
  }
});

function applyUIScale(scale) {
  scale = parseFloat(scale) || 1.0;
  webFrame.setZoomFactor(scale);
}

ipcRenderer.on('settings-data', (e, s) => {
  settings = s;
  if (settings.homepage) document.getElementById('set-homepage').value = settings.homepage;
  if (settings.searchEngine) document.getElementById('set-search-engine').value = settings.searchEngine;
  if (settings.userAgentMode) {
    document.getElementById('set-ua-mode').value = settings.userAgentMode;
    toggleCustomUA();
  }
  if (settings.customUserAgent) document.getElementById('set-custom-ua').value = settings.customUserAgent;
  if (settings.showBookmarksBar !== undefined) document.getElementById('set-bookmarks-bar').checked = settings.showBookmarksBar;
  if (settings.zoomFactor) {
    document.getElementById('set-zoom').value = settings.zoomFactor;
    setZoom(settings.zoomFactor);
  }
  if (settings.uiScale) {
    document.getElementById('set-ui-scale').value = settings.uiScale;
    applyUIScale(settings.uiScale);
  }
  if (settings.ntpRecent !== undefined) document.getElementById('set-ntp-recent').checked = settings.ntpRecent;
  if (settings.ntpShortcuts !== undefined) document.getElementById('set-ntp-shortcuts').checked = settings.ntpShortcuts;
  if (settings.restoreSessionOnStartup !== undefined) {
    document.getElementById('set-restore-session').checked = settings.restoreSessionOnStartup;
  }
  if (settings.adBlock !== undefined) document.getElementById('set-adblock').checked = settings.adBlock;
  if (settings.trustedDomains) {
    document.getElementById('set-trusted-domains').value = settings.trustedDomains.join('\n');
  }
  if (settings.vpnSubUrl !== undefined) {
    const subEl = document.getElementById('set-vpn-sub-url');
    if (subEl) subEl.value = settings.vpnSubUrl || '';
  }
  if (settings.vpnRoutingMode) {
    const modeEl = document.getElementById('set-vpn-routing-mode');
    if (modeEl) modeEl.value = settings.vpnRoutingMode;
  }
  if (settings.vpnCustomBlocked) {
    const customEl = document.getElementById('set-vpn-custom-blocked');
    const lines = Array.isArray(settings.vpnCustomBlocked) ? settings.vpnCustomBlocked : [];
    if (customEl) customEl.value = lines.join('\n');
  }
  if (settings.vpnAutoConnect !== undefined) {
    const autoEl = document.getElementById('set-vpn-auto-connect');
    if (autoEl) autoEl.checked = settings.vpnAutoConnect;
  }
  if (settings.theme) {
    document.getElementById('set-theme').value = settings.theme;
    applyTheme(settings.theme);
  } else {
    applyTheme('dark'); // default
  }
  applyShowBookmarksBar(settings.showBookmarksBar !== false);
});

ipcRenderer.on('settings-saved', (e, s) => {
  const t = window.t || ((k, f) => f || k);
  settings = s;
  toast(t('toast-settings-saved', 'Настройки сохранены'));
  applyShowBookmarksBar(s.showBookmarksBar !== false);
  setZoom(parseFloat(s.zoomFactor) || 1.0);
  applyUIScale(parseFloat(s.uiScale) || 1.0);
  applyTheme(s.theme || 'dark');
  closeSettings();
});

document.getElementById('btn-settings-save').addEventListener('click', () => {
  const theme = document.getElementById('set-theme').value || 'dark';
  applyTheme(theme);

  ipcRenderer.send('save-settings', {
    homepage: document.getElementById('set-homepage').value,
    searchEngine: document.getElementById('set-search-engine').value,
    userAgentMode: document.getElementById('set-ua-mode').value,
    customUserAgent: document.getElementById('set-custom-ua').value,
    showBookmarksBar: document.getElementById('set-bookmarks-bar').checked,
    zoomFactor: parseFloat(document.getElementById('set-zoom').value) || 1.0,
    uiScale: parseFloat(document.getElementById('set-ui-scale').value) || 1.0,
    ntpRecent: document.getElementById('set-ntp-recent').checked,
    ntpShortcuts: document.getElementById('set-ntp-shortcuts').checked,
    restoreSessionOnStartup: document.getElementById('set-restore-session').checked,
    adBlock: document.getElementById('set-adblock').checked,
    trustedDomains: document.getElementById('set-trusted-domains').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    vpnSubUrl: document.getElementById('set-vpn-sub-url')?.value.trim() || '',
    vpnRoutingMode: document.getElementById('set-vpn-routing-mode')?.value || 'split-ru',
    vpnCustomBlocked: (document.getElementById('set-vpn-custom-blocked')?.value || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    vpnAutoConnect: document.getElementById('set-vpn-auto-connect')?.checked || false,
    theme: theme,
    language: document.getElementById('set-language')?.value
  });
  updateNTPRecentVisits();
});

document.getElementById('set-ui-scale').addEventListener('change', (e) => {
  applyUIScale(parseFloat(e.target.value) || 1.0);
});

document.getElementById('btn-set-vpn-import-sub')?.addEventListener('click', async () => {
  const t = window.t || ((k, f) => f || k);
  const url = document.getElementById('set-vpn-sub-url')?.value.trim();
  if (!url) {
    toast(t('toast-vpn-no-url', 'Введите URL подписки'));
    return;
  }
  const btn = document.getElementById('btn-set-vpn-import-sub');
  if (btn) btn.disabled = true;
  const res = await ipcRenderer.invoke('vpn-fetch-sub', url);
  if (btn) btn.disabled = false;
  if (res.ok) {
    toast(t('toast-vpn-imported', 'Импортировано: ') + res.servers.length);
    const vpnUrl = document.getElementById('vpn-url-v3');
    if (vpnUrl) vpnUrl.value = url;
    if (typeof window.refreshVpnStatus === 'function') window.refreshVpnStatus();
  } else if (typeof toast === 'function') {
    toast(t('toast-vpn-error', 'Ошибка VPN: ') + (res.error || ''));
  }
});

document.getElementById('btn-open-vpn-from-settings')?.addEventListener('click', () => {
  if (typeof window.openVpn === 'function') window.openVpn();
});

document.getElementById('set-ua-mode').addEventListener('change', toggleCustomUA);
function toggleCustomUA() {
  document.getElementById('row-custom-ua').style.display =
    document.getElementById('set-ua-mode').value === 'custom' ? 'flex' : 'none';
}

document.getElementById('btn-clear-cookies').addEventListener('click', () => {
  const t = window.t || ((k, f) => f || k);
  ipcRenderer.send('clear-cookies');
  ipcRenderer.once('cookies-cleared', () => toast(t('toast-cookies-cleared', '🧹 Cookies и кэш очищены')));
});
document.getElementById('btn-clear-all-history').addEventListener('click', () => {
  const t = window.t || ((k, f) => f || k);
  if (confirm(t('del-hist-confirm', 'Удалить всю историю?'))) {
    ipcRenderer.send('clear-history');
    toast(t('toast-history-cleared', 'История удалена'));
  }
});

document.getElementById('btn-export-bookmarks').addEventListener('click', async () => {
  const t = window.t || ((k, f) => f || k);
  try {
    const data = await ipcRenderer.invoke('export-bookmarks');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'visibility-bookmarks.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(t('toast-bookmarks-exported', 'Закладки экспортированы'));
  } catch (e) {
    toast(t('toast-export-failed', 'Ошибка экспорта'));
  }
});

document.getElementById('btn-import-bookmarks').addEventListener('click', () => {
  const t = window.t || ((k, f) => f || k);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : (parsed.bookmarks || []);
      ipcRenderer.send('import-bookmarks', list);
      ipcRenderer.once('bookmarks-data', () => toast(t('toast-bookmarks-imported', 'Закладки импортированы')));
    } catch (e) {
      toast(t('toast-import-failed', 'Неверный файл закладок'));
    }
  };
  input.click();
});
document.getElementById('btn-reset-permissions').addEventListener('click', () => {
  const t = window.t || ((k, f) => f || k);
  ipcRenderer.send('reset-permissions');
  toast(t('toast-perms-reset', 'Все разрешения сброшены'));
});

document.getElementById('btn-import-chrome')?.addEventListener('click', async () => {
  const t = window.t || ((k, f) => f || k);
  const res = await ipcRenderer.invoke('import-chrome-bookmarks');
  if (res.ok && res.count > 0) {
    toast(t('toast-chrome-import', `Импортировано ${res.count} закладок из Chrome`));
    ipcRenderer.send('get-bookmarks');
  } else if (res.ok) {
    toast(t('toast-chrome-import-none', 'Новых закладок из Chrome не найдено'));
  } else {
    toast(t('toast-chrome-import-fail', 'Chrome не найден или файл закладок недоступен'));
  }
});

document.getElementById('btn-check-updates')?.addEventListener('click', async () => {
  const t = window.t || ((k, f) => f || k);
  const btn = document.getElementById('btn-check-updates');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const info = await ipcRenderer.invoke('check-for-updates');
    if (info.updateAvailable) {
      showUpdateModal(info);
    } else if (info.latest) {
      toast(t('toast-update-latest', 'У вас последняя версия ✓'));
    } else {
      toast(t('toast-update-unavailable', 'Не удалось проверить обновления'));
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('btn-check', 'Проверить'); }
  }
});

function showUpdateModal(info) {
  const existing = document.getElementById('update-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'update-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  const notesHtml = info.notes
    ? `<div style="
        background: rgba(0,0,0,0.25);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 12px 14px;
        margin-bottom: 16px;
        text-align: left;
        max-height: 120px;
        overflow-y: auto;
      ">
        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:6px;">Что нового</div>
        <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.5; white-space:pre-wrap;">${escHtml(info.notes)}</div>
      </div>`
    : '';

  overlay.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 1px solid var(--border-bright);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: 440px;
      max-width: 92vw;
      box-shadow: var(--shadow-lg);
      animation: fadeIn 0.2s ease;
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
    ">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <div style="
          width:36px; height:36px; border-radius:var(--radius-sm);
          background:var(--bg-tertiary); border:1px solid var(--border);
          display:flex; align-items:center; justify-content:center;
          color:var(--accent); flex-shrink:0;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 3px; color:var(--text-primary);">Доступно обновление</h3>
          <div style="font-size:12px; color:var(--text-secondary);">
            Текущая версия: ${info.current} → <span style="color:var(--accent); font-weight:600;">${info.latest}</span>
          </div>
        </div>
      </div>

      ${notesHtml}

      <label style="
        display:flex; align-items:center; gap:8px;
        margin-bottom:20px; cursor:pointer; user-select:none;
        font-size:12px; color:var(--text-muted);
      ">
        <input type="checkbox" id="update-suppress-checkbox" style="cursor:pointer; margin:0;"/>
        <span>Не напоминать для этой версии</span>
      </label>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="update-decline" class="btn-ghost" style="padding:8px 18px; font-size:12.5px;">Позже</button>
        <button id="update-accept" class="btn-primary" style="padding:8px 20px; font-size:12.5px;">Скачать обновление</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();

  overlay.querySelector('#update-decline').addEventListener('click', () => {
    const suppress = overlay.querySelector('#update-suppress-checkbox')?.checked;
    if (suppress && info.latest) {
      localStorage.setItem('visib_suppress_version', info.latest);
    }
    closeModal();
  });

  overlay.querySelector('#update-accept').addEventListener('click', () => {
    const downloadUrl = info.downloadUrl || info.url || 'https://gomp.su';
    ipcRenderer.send('open-external-url', downloadUrl);
    closeModal();
  });
}

(function autoUpdateCheck() {
  if (settings.checkUpdates === false) return;
  const count = parseInt(localStorage.getItem('visib_launch_count') || '0', 10) + 1;
  localStorage.setItem('visib_launch_count', String(count));
  if (count % 2 !== 0) return;

  setTimeout(async () => {
    try {
      const info = await ipcRenderer.invoke('check-for-updates');
      if (!info.updateAvailable || !info.latest) return;
      const suppressed = localStorage.getItem('visib_suppress_version');
      if (suppressed === info.latest) return;
      showUpdateModal(info);
    } catch (e) {}
  }, 3000);
})();

function applyShowBookmarksBar(show) {
  bookmarksBar.classList.toggle('hidden', !show);
}

function openDeleteModal() { document.getElementById('overlay-delete').classList.add('show'); }
function closeDeleteModal() {
  const el = document.getElementById('overlay-delete');
  if (window.closeOverlayAnimated) window.closeOverlayAnimated(el);
  else el?.classList.remove('show');
}
document.getElementById('overlay-delete').addEventListener('click', e => { if (e.target === e.currentTarget) closeDeleteModal(); });
function clearHistoryPeriod(period) { ipcRenderer.send('clear-history-period', period); closeDeleteModal(); }
function clearAllHistory() { ipcRenderer.send('clear-history'); closeDeleteModal(); }

document.getElementById('btn-minimize').addEventListener('click', () => ipcRenderer.send('minimize-window'));
document.getElementById('btn-maximize').addEventListener('click', () => ipcRenderer.send('maximize-window'));
document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('close-window'));
ipcRenderer.on('window-state-changed', (e, maximized) => {
  document.getElementById('btn-maximize').textContent = maximized ? '❐' : '⊡';
});

document.getElementById('btn-back').addEventListener('click', () => {
  tabGoBack(getActiveTab());
});
document.getElementById('btn-forward').addEventListener('click', () => {
  tabGoForward(getActiveTab());
});
document.getElementById('btn-reload').addEventListener('click', () => {
  const t = getActiveTab(); if (!t) return;
  if (loadingBar.classList.contains('active')) tabStop(t);
  else tabReload(t);
});
document.getElementById('btn-home').addEventListener('click', () => navigate(settings.homepage || 'https://www.google.com'));
newTabBtn.addEventListener('click', () => createNewTab(null, isIncognito));

function openIncomingUrl(url) {
  if (!url) return;

  if (tabs.length === 0) {
    createNewTab(url, isIncognito);
    return;
  }

  const first = tabs[0];
  const hasSingleBlankTab =
    tabs.length === 1 &&
    first &&
    first.isNewTabPage === true;

  if (hasSingleBlankTab) {
    switchTab(first.id);
    navigate(url);
    return;
  }

  createNewTab(url, isIncognito);
}

window.createNewTab = createNewTab;
window.openIncomingUrl = openIncomingUrl;

ipcRenderer.on('load-url', (e, url) => {
  openIncomingUrl(url);
});

ipcRenderer.on('open-new-tab', (e, url) => {
  openIncomingUrl(url);
});

ipcRenderer.on('init-incognito', (e, incognito) => {
  if (incognito) {
    isIncognito = true;
    incognitoPill.classList.add('show');
    document.getElementById('btn-incognito').classList.add('active');
    statusIncognito.classList.add('show');
  }
});

let tabSearchIndex = 0;

function renderTabSearchList(query) {
  const list = document.getElementById('tab-search-list');
  if (!list) return;
  const q = String(query || '').trim().toLowerCase();
  const matched = tabs.filter((t) => {
    if (!q) return true;
    return (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q);
  });
  if (tabSearchIndex >= matched.length) tabSearchIndex = Math.max(0, matched.length - 1);
  if (!matched.length) {
    list.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:13px;">${(window.t && window.t('tab-search-empty', 'Вкладки не найдены')) || 'Вкладки не найдены'}</div>`;
    return;
  }
  list.innerHTML = matched.map((t, i) => `
    <div class="tab-search-item ${i === tabSearchIndex ? 'active' : ''}" data-id="${t.id}">
      <span class="tab-favicon">${uiSvg.globe}</span>
      <div style="min-width:0;flex:1">
        <div class="tab-search-item-title">${escHtml(t.title || 'Tab')}</div>
        <div class="tab-search-item-url">${escHtml(t.url || '')}</div>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.tab-search-item').forEach((el) => {
    el.addEventListener('click', () => {
      switchTab(Number(el.dataset.id));
      closeTabSearch();
    });
  });
}

function openTabSearch() {
  const overlay = document.getElementById('overlay-tab-search');
  const input = document.getElementById('tab-search-input');
  if (!overlay || !input) return;
  overlay.classList.remove('closing');
  overlay.classList.add('show');
  tabSearchIndex = 0;
  input.value = '';
  renderTabSearchList('');
  setTimeout(() => input.focus(), 60);
}

function closeTabSearch() {
  const overlay = document.getElementById('overlay-tab-search');
  if (window.closeOverlayAnimated) window.closeOverlayAnimated(overlay);
  else overlay?.classList.remove('show');
}

function activateTabSearchSelection() {
  const list = document.getElementById('tab-search-list');
  const active = list?.querySelector('.tab-search-item.active');
  if (active) {
    switchTab(Number(active.dataset.id));
    closeTabSearch();
  }
}

document.getElementById('tab-search-input')?.addEventListener('input', (e) => {
  tabSearchIndex = 0;
  renderTabSearchList(e.target.value);
});
document.getElementById('tab-search-input')?.addEventListener('keydown', (e) => {
  const list = document.getElementById('tab-search-list');
  const items = list ? [...list.querySelectorAll('.tab-search-item')] : [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    tabSearchIndex = Math.min(tabSearchIndex + 1, Math.max(0, items.length - 1));
    renderTabSearchList(e.target.value);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    tabSearchIndex = Math.max(tabSearchIndex - 1, 0);
    renderTabSearchList(e.target.value);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    activateTabSearchSelection();
  } else if (e.key === 'Escape') {
    closeTabSearch();
  }
});
document.getElementById('overlay-tab-search')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeTabSearch();
});

function executeBrowserShortcut(action) {
  if (!action) return;

  switch (action) {
    case 'new-tab':
      createNewTab(null, isIncognito);
      break;
    case 'reopen-tab':
      if (closedTabsStack.length) {
        const c = closedTabsStack.pop();
        createNewTab(c.url || null, c.incognito);
      }
      break;
    case 'close-tab': {
      const t = getActiveTab();
      if (t) closeTab(t.id);
      break;
    }
    case 'next-tab':
      if (tabs.length) {
        const ci = tabs.findIndex(t => t.id === activeTabId);
        switchTab(tabs[(ci + 1) % tabs.length].id);
      }
      break;
    case 'prev-tab':
      if (tabs.length) {
        const ci = tabs.findIndex(t => t.id === activeTabId);
        switchTab(tabs[(ci - 1 + tabs.length) % tabs.length].id);
      }
      break;
    case 'reload':
      tabReload(getActiveTab());
      break;
    case 'hard-reload':
      tabReload(getActiveTab(), true);
      break;
    case 'focus-url':
      urlBar.focus();
      urlBar.select();
      break;
    case 'toggle-sidebar':
      if (window.iosUI) window.iosUI.toggleSidebar();
      break;
    case 'toggle-downloads':
      toggleDownloads();
      break;
    case 'incognito':
      ipcRenderer.send('open-incognito-window');
      break;
    case 'bookmark':
      document.getElementById('btn-bookmark')?.click();
      break;
    case 'toggle-bookmarks-bar':
      toggleBookmarksBar();
      break;
    case 'copy-url': {
      const tab = getActiveTab();
      const url = getTabUrl(tab);
      if (url) {
        navigator.clipboard.writeText(url);
        toast((window.t ? window.t('toast-url-copied', 'Ссылка скопирована') : 'Ссылка скопирована'));
      }
      break;
    }
    case 'open-bookmarks':
      openBookmarksSidebar();
      break;
    case 'tab-search':
      openTabSearch();
      break;
    case 'zoom-in':
      setZoom(+(currentZoom + 0.1).toFixed(2));
      break;
    case 'zoom-out':
      setZoom(+(currentZoom - 0.1).toFixed(2));
      break;
    case 'zoom-reset':
      setZoom(1.0);
      break;
    case 'back':
      tabGoBack(getActiveTab());
      break;
    case 'forward':
      tabGoForward(getActiveTab());
      break;
    case 'clear-history':
      openDeleteModal();
      break;
    case 'find':
      if (typeof window.openFind === 'function') {
        const findBar = document.getElementById('find-bar');
        const findInput = document.getElementById('find-input');
        if (findBar?.classList.contains('show')) {
          findInput?.focus();
          findInput?.select();
        } else {
          window.openFind();
        }
      }
      break;
    case 'pip':
      if (typeof togglePictureInPicture === 'function') togglePictureInPicture();
      break;
    case 'translate':
      if (typeof translatePage === 'function') translatePage();
      break;
    case 'reader-mode':
      if (typeof toggleReaderMode === 'function') toggleReaderMode();
      break;
    case 'screenshot':
      if (typeof takeScreenshot === 'function') takeScreenshot();
      break;
    case 'perf-monitor':
      if (typeof togglePerformanceMonitor === 'function') togglePerformanceMonitor();
      break;
    case 'devtools': {
      const t = getActiveTab();
      if (t?.useBrowserView) {
        ipcRenderer.send('bv-devtools', t.id);
      } else if (t?.webview) {
        try {
          t.webview.isDevToolsOpened() ? t.webview.closeDevTools() : t.webview.openDevTools();
        } catch (e) {}
      }
      break;
    }
    case 'escape':
      if (document.getElementById('overlay-tab-search')?.classList.contains('show')) closeTabSearch();
      else if (document.getElementById('overlay-settings')?.classList.contains('show')) closeSettings();
      else if (document.getElementById('overlay-delete')?.classList.contains('show')) closeDeleteModal();
      else if (document.getElementById('overlay-cert')?.classList.contains('show')) closeCert();
      else if (document.getElementById('overlay-vpn')?.classList.contains('show')) window.closeVpn?.();
      else if (document.getElementById('find-bar')?.classList.contains('show')) window.closeFind?.();
      else if (document.activeElement === urlBar) urlBar.blur();
      break;
    default:
      if (action.startsWith('tab-')) {
        const idx = parseInt(action.slice(4), 10) - 1;
        if (idx === 8 && tabs.length) switchTab(tabs[tabs.length - 1].id);
        else if (tabs[idx]) switchTab(tabs[idx].id);
      }
      break;
  }
}

function handleShortcutInput(input) {
  const action = matchShortcut(input);
  if (!action) return false;
  executeBrowserShortcut(action);
  return true;
}

window.hookBrowserShortcuts = (wv) => {
  wv.addEventListener('before-input-event', (e) => {
    if (handleShortcutInput(e.input)) e.preventDefault();
  });
};

document.addEventListener('keydown', e => {
  if (handleShortcutInput({
    type: 'keyDown',
    key: e.key,
    control: e.ctrlKey,
    meta: e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey
  })) {
    e.preventDefault();
  }
});

ipcRenderer.on('browser-shortcut', (e, { action }) => {
  executeBrowserShortcut(action);
});

const dragStyle = document.createElement('style');
dragStyle.textContent = `.tab.drag-over { border-color: var(--accent) !important; background: var(--accent-dim) !important; }`;
document.head.appendChild(dragStyle);

window.addEventListener('resize', debounce(() => {
  updateTabWidths();
  if (permActive) positionPermPopup();
  syncBrowserViewBounds();
}, 100));

ipcRenderer.on('bv-title', (e, { tabId, title }) => {
  updateTabTitle(tabId, title);
  if (getActiveTab()?.id === tabId) document.title = title + ' — Visibility Browser';
});

ipcRenderer.on('bv-navigate', (e, { tabId, url }) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || url.startsWith('data:') || url === 'about:blank') return;
  tab.url = url;
  tab.isNewTabPage = false;
  if (!tab.incognito && url.startsWith('http')) {
    ipcRenderer.send('add-to-history', { url, title: tab.title || url });
  }
  if (getActiveTab()?.id === tabId) {
    urlBar.value = url;
    updateSecurityIcon(url);
    refreshNavButtonsAsync();
    updateBookmarkBtn(url);
  }
});

ipcRenderer.on('bv-loading', (e, { tabId, loading }) => {
  if (getActiveTab()?.id !== tabId) return;
  loadingBar.classList.toggle('active', loading);
  setReloadButtonLoading(loading);
});

ipcRenderer.on('bv-favicon', (e, { tabId, favicon }) => {
  const favEl = document.getElementById('fav-' + tabId);
  if (favEl) favEl.innerHTML = `<img src="${favicon}" style="width:16px;height:16px;object-fit:contain" onerror="this.parentElement.innerHTML='${uiSvg.globe.replace(/"/g, '&quot;')}'">`;
  const tab = tabs.find(t => t.id === tabId);
  if (tab) tab.favicon = favicon;
});

ipcRenderer.on('bv-media', (e, { tabId, playing }) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.mediaPlaying = playing;
  const audioEl = tab.element.querySelector('.tab-audio');
  if (!audioEl) return;
  if (playing || tab.isMuted) {
    audioEl.style.display = 'flex';
    if (tab.isMuted) {
      audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
      audioEl.classList.add('muted');
    } else {
      audioEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      audioEl.classList.remove('muted');
    }
    audioEl.style.display = 'none';
  }
});

function generateErrorPage(url, description, isSsl) {
  const title = isSsl ? 'Ошибка безопасности' : 'Не удалось открыть страницу';
  const errorCode = (description && description.includes('ERR_')) 
    ? description.match(/ERR_[A-Z_]+/)?.[0] || description
    : (isSsl ? 'ERR_CERT_INVALID' : 'ERR_CONNECTION_CLOSED');

  const iconSvg = isSsl 
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;

  return `
    <!DOCTYPE html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background: #0e0f14;
            color: #e2e8f0;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
            user-select: none;
            padding: 24px;
          }
          .container {
            max-width: 380px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .icon-box {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 18px;
            color: ${isSsl ? '#f87171' : '#94a3b8'};
          }
          h1 {
            font-size: 17px;
            font-weight: 600;
            color: #f8fafc;
            letter-spacing: -0.2px;
            margin-bottom: 6px;
          }
          .error-code {
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
            font-size: 12px;
            color: #64748b;
            margin-bottom: 6px;
          }
          .url-text {
            font-size: 11.5px;
            color: #475569;
            word-break: break-all;
            margin-bottom: 22px;
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
          }
          .btn-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            max-width: 200px;
          }
          .btn {
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #f1f5f9;
            padding: 8px 16px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            text-decoration: none;
            outline: none;
          }
          .btn:hover {
            background: rgba(255, 255, 255, 0.14);
            border-color: rgba(255, 255, 255, 0.2);
            color: #ffffff;
          }
          .btn:active {
            transform: scale(0.98);
          }
          .btn-danger {
            color: #f87171;
            border-color: rgba(248, 113, 113, 0.2);
          }
          .btn-danger:hover {
            background: rgba(248, 113, 113, 0.12);
            border-color: rgba(248, 113, 113, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon-box">${iconSvg}</div>
          <h1>${title}</h1>
          <div class="error-code">${errorCode}</div>
          <div class="url-text">${url}</div>
          <div class="btn-group">
            <button class="btn" onclick="location.href='${url}'">Попробовать снова</button>
            ${isSsl ? `<button class="btn btn-danger" onclick="console.log('visib-bypass:${url}')">Игнорировать риск</button>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;
}

ipcRenderer.on('guest-render-gone', (e, { guestId }) => {
  const tab = tabs.find(t => t.guestId === guestId);
  if (tab) recoverCrashedTab(tab);
});

ipcRenderer.send('get-settings');
ipcRenderer.once('settings-data', (e, s) => {
  settings = s;
  applyShowBookmarksBar(s.showBookmarksBar !== false);
  currentZoom = parseFloat(s.zoomFactor) || 1.0;
  updateZoomUI();
  if (tabs.length === 0) createNewTab();
  ipcRenderer.send('get-bookmarks');
  setTimeout(restoreSession, 350);
});
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (e) {
    return null;
  }
}

function highlightQuery(text, query) {
  if (!query || !text) return escHtml(text || '');
  const safeText = escHtml(text);
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return safeText;
  
  try {
    const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    return safeText.replace(regex, '<span class="suggestion-highlight">$1</span>');
  } catch (e) {
    return safeText;
  }
}

async function fetchHistorySuggestions(q) {
  return new Promise((resolve) => {
    const channel = 'history-data-suggestions-' + Date.now();
    ipcRenderer.once(channel, (e, data) => {
      const seen = new Set();
      const uniqueMatches = [];
      for (const h of (data || [])) {
        const titleKey = (h.title || '').trim().toLowerCase();
        if (!titleKey || seen.has(titleKey)) continue;
        seen.add(titleKey);
        
        let displayUrl = h.url || '';
        try {
          displayUrl = decodeURIComponent(displayUrl);
        } catch (ex) {}
        
        uniqueMatches.push({
          text: h.title,
          url: displayUrl,
          type: 'history',
          icon: getFaviconUrl(h.url) || uiSvg.clock,
          isFavicon: !!getFaviconUrl(h.url)
        });
        if (uniqueMatches.length >= 4) break;
      }
      resolve(uniqueMatches);
    });
    ipcRenderer.send('search-history-specific', { query: q, replyChannel: channel });
  });
}

async function fetchGoogleSuggestions(q) {
  try {
    const resp = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q)}`);
    const data = await resp.json();
    return (data[1] || []).slice(0, 6).map(s => ({
      text: s,
      url: null,
      type: 'search',
      icon: uiSvg.search
    }));
  } catch (e) { return []; }
}

const updateSuggestions = debounce(async (q, inputEl) => {
  q = q.trim();
  if (q.length < 2) {
    hideSuggestions();
    return;
  }

  lastSuggestionQuery = q;
  const historyItems = await fetchHistorySuggestions(q);
  const searchItems = await fetchGoogleSuggestions(q);

  if (historyItems.length > 0) {
    suggestionResults = [...historyItems, ...searchItems];
  } else {
    suggestionResults = searchItems;
  }

  renderSuggestions(suggestionResults, inputEl);
}, 100);

let suggestionsClickOutsideHandler = null;

function renderSuggestions(results, inputEl) {
  if (!results.length) {
    hideSuggestions();
    return;
  }

  const fragment = document.createDocumentFragment();
  selectedSuggestionIdx = -1;

  results.forEach((res, idx) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.dataset.idx = idx;
    item.dataset.url = res.url || '';
    item.dataset.text = res.text || '';
    
    const isHistory = res.type === 'history';
    const typeLabel = isHistory ? 'История' : 'Поиск';
    const typeClass = isHistory ? 'type-history' : 'type-search';
    const defaultIcon = isHistory ? uiSvg.clock : uiSvg.search;
    
    const iconHtml = res.isFavicon 
      ? `<img src="${escAttr(res.icon)}" alt="" onerror="this.style.display='none'; this.parentNode.innerHTML='${escAttr(defaultIcon)}'">`
      : (res.icon || defaultIcon);
    
    const textHtml = highlightQuery(res.text, lastSuggestionQuery);
    
    item.innerHTML = `
      <span class="suggestion-icon">${iconHtml}</span>
      <div class="suggestion-content">
        <span class="suggestion-text">${textHtml}</span>
        ${res.url ? `<span class="suggestion-url">${escHtml(res.url)}</span>` : ''}
      </div>
      <span class="suggestion-type ${typeClass}">${typeLabel}</span>
    `;
    fragment.appendChild(item);
  });

  suggestionsDropdown.innerHTML = '';
  suggestionsDropdown.appendChild(fragment);

  suggestionsDropdown.onclick = (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const url = item.dataset.url;
      const text = item.dataset.text;
      navigate(url || text);
      hideSuggestions();
    }
  };

  const rect = inputEl.getBoundingClientRect();
  suggestionsDropdown.style.position = 'fixed';
  suggestionsDropdown.style.left = rect.left + 'px';
  suggestionsDropdown.style.width = rect.width + 'px';
  suggestionsDropdown.style.top = (rect.bottom + 6) + 'px';
  suggestionsDropdown.style.display = 'block';
  
  if (suggestionsClickOutsideHandler) {
    document.removeEventListener('click', suggestionsClickOutsideHandler);
  }
  suggestionsClickOutsideHandler = (e) => {
    if (!suggestionsDropdown.contains(e.target) && e.target !== inputEl) {
      hideSuggestions();
    }
  };
  setTimeout(() => {
    document.addEventListener('click', suggestionsClickOutsideHandler);
  }, 10);
}

function hideSuggestions() {
  suggestionsDropdown.style.display = 'none';
  suggestionResults = [];
  selectedSuggestionIdx = -1;
  if (suggestionsClickOutsideHandler) {
    document.removeEventListener('click', suggestionsClickOutsideHandler);
    suggestionsClickOutsideHandler = null;
  }
}

function handleSuggestionKey(e, inputEl) {
  if (suggestionsDropdown.style.display === 'none') return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIdx = (selectedSuggestionIdx + 1) % suggestionResults.length;
    highlightSuggestion();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIdx = (selectedSuggestionIdx - 1 + suggestionResults.length) % suggestionResults.length;
    highlightSuggestion();
  } else if (e.key === 'Enter' && selectedSuggestionIdx !== -1) {
    e.preventDefault();
    const res = suggestionResults[selectedSuggestionIdx];
    if (res.url) navigate(res.url);
    else navigate(res.text);
    hideSuggestions();
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

function highlightSuggestion() {
  const allItems = suggestionsDropdown.querySelectorAll('.suggestion-item');
  allItems.forEach((item, idx) => {
    item.classList.toggle('selected', idx === selectedSuggestionIdx);
  });
}

urlBar.addEventListener('input', () => updateSuggestions(urlBar.value, urlBar));
urlBar.addEventListener('keydown', (e) => handleSuggestionKey(e, urlBar));
urlBar.addEventListener('blur', () => setTimeout(hideSuggestions, 200));

ntpSearchInput.addEventListener('input', () => updateSuggestions(ntpSearchInput.value, ntpSearchInput));
ntpSearchInput.addEventListener('keydown', (e) => handleSuggestionKey(e, ntpSearchInput));
ntpSearchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 200));

function updateNTPClock() {
  const clockEl = document.getElementById('ntp-clock');
  const greetEl = document.getElementById('ntp-greeting');
  if (!clockEl) return;

  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  clockEl.textContent = `${h}:${m}`;

  if (greetEl) {
    const t = window.t || ((k, f) => f || k);
    if (h >= 5 && h < 12) greetEl.textContent = t('ntp-morning', 'Доброе утро');
    else if (h >= 12 && h < 17) greetEl.textContent = t('ntp-afternoon', 'Добрый день');
    else if (h >= 17 && h < 22) greetEl.textContent = t('ntp-evening', 'Добрый вечер');
    else greetEl.textContent = t('ntp-night', 'Доброй ночи');
  }
}
updateNTPClock();
setInterval(updateNTPClock, 30000);

const weatherIcons = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌧️', 55: '🌧️',
  56: '🌧️', 57: '🌧️',
  61: '🌦️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️',
  77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const weatherDescRu = {
  0: 'Ясно', 1: 'Малооблачно', 2: 'Переменная облачность', 3: 'Пасмурно',
  45: 'Туман', 48: 'Изморозь',
  51: 'Мелкий дождь', 53: 'Дождь', 55: 'Сильный дождь',
  56: 'Ледяной дождь', 57: 'Ледяной дождь',
  61: 'Лёгкий дождь', 63: 'Умеренный дождь', 65: 'Сильный дождь',
  66: 'Ледяной дождь', 67: 'Ледяной дождь',
  71: 'Лёгкий снег', 73: 'Снег', 75: 'Сильный снег',
  77: 'Снежная крупа',
  80: 'Ливень', 81: 'Ливень', 82: 'Сильный ливень',
  85: 'Снегопад', 86: 'Сильный снегопад',
  95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза',
};

async function fetchNTPWeather() {
  const tempEl = document.getElementById('ntp-weather-temp');
  const descEl = document.getElementById('ntp-weather-desc');
  const cityEl = document.getElementById('ntp-weather-city');
  const iconEl = document.getElementById('ntp-weather-icon');
  const weatherCard = document.getElementById('ntp-weather');
  if (!tempEl) return;

  if (weatherCard && !weatherCard._hasClick) {
    weatherCard._hasClick = true;
    weatherCard.style.cursor = 'pointer';
    weatherCard.title = 'Нажмите, чтобы изменить город для погоды';
    weatherCard.addEventListener('click', async () => {
      const currentCity = localStorage.getItem('visib_custom_city') || cityEl?.textContent || '';
      const input = prompt('Введите ваш город для погоды (или оставьте пустым для авто-определения):', currentCity);
      if (input !== null) {
        const trimmed = input.trim();
        if (trimmed) {
          localStorage.setItem('visib_custom_city', trimmed);
        } else {
          localStorage.removeItem('visib_custom_city');
        }
        fetchNTPWeather();
      }
    });
  }

  try {
    const customCity = localStorage.getItem('visib_custom_city');
    const result = await ipcRenderer.invoke('get-ntp-weather', customCity);
    if (result && typeof result.temp === 'number') {
      tempEl.textContent = `${result.temp}°C`;
      descEl.textContent = result.desc || weatherDescRu[result.code] || 'Погода';
      cityEl.textContent = result.city || '';
      iconEl.textContent = weatherIcons[result.code] || '🌤️';
    } else {
      descEl.textContent = 'Ошибка загрузки';
      tempEl.textContent = '--°C';
      iconEl.textContent = '🌐';
    }
  } catch (e) {
    descEl.textContent = 'Нет подключения';
    tempEl.textContent = '--°C';
    iconEl.textContent = '🌐';
  }
}
fetchNTPWeather();
setInterval(fetchNTPWeather, 15 * 60 * 1000);

function updateNTPRecentVisits() {
  const grid = document.getElementById('ntp-recent-grid');
  const recentTitle = document.querySelector('.ntp-recent-title');
  const shortcuts = document.querySelector('.ntp-shortcuts');

  if (settings && settings.ntpRecent === false) {
    if (grid) grid.style.display = 'none';
    if (recentTitle) recentTitle.style.display = 'none';
  } else {
    if (grid) grid.style.display = '';
    if (recentTitle) recentTitle.style.display = '';
  }

  if (settings && settings.ntpShortcuts === false) {
    if (shortcuts) shortcuts.style.display = 'none';
  } else {
    if (shortcuts) shortcuts.style.display = 'flex';
  }

  if (!grid || (settings && settings.ntpRecent === false)) return;

  const channel = 'history-data-ntp-' + Date.now();
  ipcRenderer.once(channel, (e, data) => {
    const fragment = document.createDocumentFragment();
    
    const unique = [];
    const seen = new Set();
    for (const h of data) {
      try {
        const domain = new URL(h.url).hostname;
        if (!seen.has(domain)) {
          seen.add(domain);
          unique.push(h);
        }
      } catch (e) { }
      if (unique.length >= 10) break;
    }

    if (unique.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; opacity:0.5; text-align:center;">Тут появятся ваши недавние сайты</div>';
      return;
    }

    unique.forEach(h => {
      const item = document.createElement('div');
      item.className = 'ntp-recent-item';
      item.title = h.url;
      item.innerHTML = `
        <div class='ntp-recent-favicon' style='font-size:24px;margin-bottom:10px;'>${uiSvg.globe}</div>
        <div class="ntp-recent-name">${escHtml(h.title)}</div>
      `;
      const favicon = item.querySelector('.ntp-recent-favicon');
      const domain = new URL(h.url).hostname;
      const img = new Image();
      img.src = 'https://icon.horse/icon/' + domain;
      img.onload = () => {
        img.style.cssText = 'width:24px;height:24px;object-fit:contain;margin-bottom:10px;';
        favicon.replaceWith(img);
      };
      
      item.addEventListener('click', () => navigate(h.url));
      fragment.appendChild(item);
    });

    grid.innerHTML = '';
    grid.appendChild(fragment);
  });
  ipcRenderer.send('get-history-specific', channel);
}


let gestureStartX = 0;
let gestureStartY = 0;
let isGestureActive = false;
const GESTURE_THRESHOLD = 100; // pixels
const GESTURE_MAX_Y = 50; // max vertical deviation

document.addEventListener('mousedown', (e) => {
  if (e.button === 3 || (e.button === 0 && e.clientX < 50)) {
    gestureStartX = e.clientX;
    gestureStartY = e.clientY;
    isGestureActive = true;
  }
});

document.addEventListener('mouseup', (e) => {
  if (!isGestureActive) return;
  isGestureActive = false;
  
  const deltaX = e.clientX - gestureStartX;
  const deltaY = Math.abs(e.clientY - gestureStartY);
  
  if (deltaY > GESTURE_MAX_Y) return; // Too much vertical movement
  
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  if (deltaX > GESTURE_THRESHOLD) {
    if (tab.webview.canGoForward && tab.webview.canGoForward()) {
      tab.webview.goForward();
      showInfo('Forward', 'Navigation');
    }
  } else if (deltaX < -GESTURE_THRESHOLD) {
    if (tab.webview.canGoBack && tab.webview.canGoBack()) {
      tab.webview.goBack();
      showInfo('Back', 'Navigation');
    }
  }
});

async function togglePictureInPicture() {
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  try {
    const hasVideo = await tab.webview.executeJavaScript(`
      document.querySelector('video') !== null
    `);
    
    if (!hasVideo) {
      toast((window.t ? window.t('vid-not-found', 'Видео не найдено') : 'Видео не найдено'));
      return;
    }
    
    await tab.webview.executeJavaScript(`
      const video = document.querySelector('video');
      if (video) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          video.requestPictureInPicture().catch(err => {
            console.error('PiP error:', err);
          });
        }
      }
    `);
  } catch (e) {
    toast((window.t ? window.t('vid-pip-fail', 'PiP недоступен') : 'PiP недоступен') + ': ' + e.message);
  }
}




window.addEventListener('beforeunload', () => {
  const sessionData = {
    tabs: tabs.filter(t => t.url && !t.isNewTabPage).map(t => ({ url: t.url, title: t.title, incognito: t.incognito })),
    activeTabId: activeTabId,
    timestamp: Date.now()
  };
  localStorage.setItem('visibility_session_backup', JSON.stringify(sessionData));
  ipcRenderer.send('save-session', sessionData);
});

function applyRestoredSession(session, { silent = false } = {}) {
  const t = window.t || ((k, f) => f || k);
  const valid = (session?.tabs || []).filter(tab => tab.url && tab.url !== 'about:blank' && !tab.url.startsWith('data:text/html'));
  if (!valid.length) return false;

  if (tabs.length === 1 && tabs[0].isNewTabPage) closeTab(tabs[0].id);
  valid.forEach(tab => createNewTab(tab.url, !!tab.incognito));
  if (!silent) showSuccess(t('session-restored', 'Сессия восстановлена'));
  localStorage.removeItem('visibility_session_backup');
  return true;
}

function showSessionRestoreModal(session) {
  const t = window.t || ((k, f) => f || k);
  const i = window.icon || ((n) => n);
  
  const overlay = document.createElement('div');
  overlay.id = 'session-restore-modal';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;
  
  const validTabs = (session?.tabs || []).filter(t => t.url && t.url !== 'about:blank' && !t.url.startsWith('data:'));
  const tabCount = validTabs.length;
  if (!tabCount) return;
  
  const pluralTabs = (count) => {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return 'вкладок';
    if (n1 > 1 && n1 < 5) return 'вкладки';
    if (n1 === 1) return 'вкладка';
    return 'вкладок';
  };
  const countWord = pluralTabs(tabCount);

  overlay.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      border: 1px solid var(--border-bright);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: 440px;
      max-width: 92vw;
      box-shadow: var(--shadow-lg);
      animation: fadeIn 0.2s ease;
      color: var(--text-primary);
      font-family: 'Inter', sans-serif;
    ">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <div style="
          width:36px; height:36px; border-radius:var(--radius-sm);
          background:var(--bg-tertiary); border:1px solid var(--border);
          display:flex; align-items:center; justify-content:center;
          color:var(--accent); flex-shrink:0;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <h3 style="font-size:16px; font-weight:700; margin:0 0 3px; color:var(--text-primary);">${t('restore-session-title', 'Восстановить прошлую сессию?')}</h3>
          <div style="font-size:12px; color:var(--text-secondary);">
            Найдено ${tabCount} ${countWord} из предыдущего запуска
          </div>
        </div>
      </div>

      <div style="
        background: rgba(0,0,0,0.25);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 4px;
        margin-bottom: 20px;
        max-height: 160px;
        overflow-y: auto;
      ">
        ${validTabs.slice(0, 6).map((tabItem) => {
          let hostname = '';
          try { hostname = new URL(tabItem.url).hostname; } catch (e) { hostname = tabItem.url || ''; }
          const favSrc = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32` : '';
          return `
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 10px;
              border-radius: 6px;
              transition: background 0.15s;
            " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
              <div style="width:20px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${favSrc ? `<img src="${favSrc}" width="14" height="14" style="object-fit:contain;" onerror="this.onerror=null;this.parentNode.innerHTML='🌐';"/>` : `<span style="font-size:12px;">🌐</span>`}
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:12.5px; font-weight:500; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(tabItem.title || hostname || 'Новая вкладка')}</div>
                <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(hostname || tabItem.url)}</div>
              </div>
            </div>
          `;
        }).join('')}
        ${tabCount > 6 ? `<div style="text-align:center; padding:6px; font-size:11.5px; color:var(--text-muted);">+ ещё ${tabCount - 6} ${pluralTabs(tabCount - 6)}</div>` : ''}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="restore-decline" class="btn-ghost" style="padding:8px 18px; font-size:12.5px;">${t('restore-no', 'Не открывать')}</button>
        <button id="restore-accept" class="btn-primary" style="padding:8px 20px; font-size:12.5px;">${t('restore-yes', 'Восстановить')}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('#restore-decline').addEventListener('click', () => {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => overlay.remove(), 200);
    localStorage.removeItem('visibility_session_backup');
  });
  
  overlay.querySelector('#restore-accept').addEventListener('click', () => {
    applyRestoredSession(session);
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => overlay.remove(), 200);
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.style.animation = 'fadeIn 0.2s ease reverse';
      setTimeout(() => overlay.remove(), 200);
      localStorage.removeItem('visibility_session_backup');
    }
  });
}

function checkFirstTimeUser() {
  if (localStorage.getItem('visibility_first_run_done')) return;
  const t = window.t || ((k, f) => f || k);

  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = `
    <style>
      @keyframes wFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes wSlideUp { from { opacity: 0; transform: translateY(32px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes wFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      #welcome-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: var(--bg-primary);
        display: flex; align-items: center; justify-content: center;
        animation: wFadeIn 0.55s cubic-bezier(0.32, 0.72, 0, 1);
      }
      .welcome-card {
        width: 520px; max-width: 90vw; text-align: center;
        animation: wSlideUp 0.65s cubic-bezier(0.34, 1.25, 0.64, 1);
      }
      .welcome-logo {
        width: 96px; height: 96px; border-radius: 24px;
        margin: 0 auto 28px;
        animation: wFloat 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        box-shadow: 0 16px 48px rgba(255,255,255,0.08);
      }
      .welcome-title {
        font-size: 32px; font-weight: 800; color: var(--text-primary);
        margin: 0 0 8px; letter-spacing: -0.5px;
      }
      .welcome-subtitle {
        font-size: 14px; color: var(--text-muted); margin: 0 0 36px;
      }
      .welcome-features {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        text-align: left; margin-bottom: 36px;
      }
      .welcome-feature {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px; padding: 18px;
        transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), background 0.35s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.35s cubic-bezier(0.32, 0.72, 0, 1);
        animation: wSlideUp 0.55s cubic-bezier(0.34, 1.25, 0.64, 1) backwards;
      }
      .welcome-feature:nth-child(1) { animation-delay: 0.1s; }
      .welcome-feature:nth-child(2) { animation-delay: 0.2s; }
      .welcome-feature:nth-child(3) { animation-delay: 0.3s; }
      .welcome-feature:nth-child(4) { animation-delay: 0.4s; }
      .welcome-feature:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.12);
        transform: translateY(-3px) scale(1.01);
      }
      .wf-icon {
        width: 36px; height: 36px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 10px; flex-shrink: 0;
      }
      .wf-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
      .wf-desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
      .welcome-start {
        background: var(--accent); color: var(--bg-primary);
        border: none; border-radius: 12px; padding: 14px 48px;
        font-size: 15px; font-weight: 700; cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.34, 1.25, 0.64, 1), background 0.25s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        animation: wSlideUp 0.55s cubic-bezier(0.34, 1.25, 0.64, 1) 0.45s backwards;
      }
      .welcome-start:hover {
        background: var(--accent-hover); transform: translateY(-2px) scale(1.02);
        box-shadow: 0 12px 32px rgba(255,255,255,0.12);
      }
      .welcome-start:active { transform: scale(0.96); transition-duration: 0.08s; }
      .welcome-version {
        font-size: 11px; color: var(--text-muted); opacity: 0.4; margin-top: 20px;
      }
    </style>
    <div class="welcome-card">
      <img class="welcome-logo" src="icon.png" alt="Visibility" />
      <h1 class="welcome-title">${t('welcome-title', 'Добро пожаловать в Visibility')}</h1>
      <p class="welcome-subtitle">${t('welcome-subtitle', 'Быстрый браузер от GOmp Studios')}</p>

      <div class="welcome-features">
        <div class="welcome-feature">
          <div class="wf-icon" style="background: rgba(99,102,241,0.15); color: #818cf8;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div class="wf-title">${t('welcome-f1-title', 'Скорость')}</div>
          <div class="wf-desc">${t('welcome-f1-desc', 'Мгновенная загрузка страниц на движке Chromium')}</div>
        </div>
        <div class="welcome-feature">
          <div class="wf-icon" style="background: rgba(16,185,129,0.15); color: #34d399;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <div class="wf-title">${t('welcome-f2-title', 'Приватность')}</div>
          <div class="wf-desc">${t('welcome-f2-desc', 'Режим инкогнито и контроль над данными')}</div>
        </div>
        <div class="welcome-feature">
          <div class="wf-icon" style="background: rgba(245,158,11,0.15); color: #fbbf24;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          </div>
          <div class="wf-title">${t('welcome-f3-title', 'Расширения')}</div>
          <div class="wf-desc">${t('welcome-f3-desc', 'Устанавливайте .visibility расширения')}</div>
        </div>
        <div class="welcome-feature">
          <div class="wf-icon" style="background: rgba(236,72,153,0.15); color: #f472b6;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </div>
          <div class="wf-title">${t('welcome-f4-title', 'Настройка')}</div>
          <div class="wf-desc">${t('welcome-f4-desc', 'Темы, масштаб, горячие клавиши — всё под вас')}</div>
        </div>
      </div>

      <button class="welcome-start" id="btn-welcome-start">${t('welcome-start', 'Начать')}</button>
      <div class="welcome-version" id="welcome-version">Visibility Browser</div>
    </div>
  `;

  document.body.appendChild(overlay);

  ipcRenderer.invoke('get-app-version').then((ver) => {
    const el = document.getElementById('welcome-version');
    if (el) el.textContent = `Visibility Browser v${ver}`;
  }).catch(() => {
    const el = document.getElementById('welcome-version');
    if (el) el.textContent = 'Visibility Browser v2.1.0';
  });

  document.getElementById('btn-welcome-start').addEventListener('click', () => {
    localStorage.setItem('visibility_first_run_done', '1');
    overlay.style.animation = 'wFadeIn 0.35s cubic-bezier(0.32, 0, 0.67, 0) reverse forwards';
    setTimeout(() => {
      overlay.remove();
    }, 300);
  });
}

async function restoreSession() {
  try {
    if (settings.restoreSessionOnStartup !== false) {
      const last = await ipcRenderer.invoke('get-last-session');
      if (last?.tabs?.length && applyRestoredSession(last, { silent: true })) {
        if (!localStorage.getItem('visibility_first_run_done')) checkFirstTimeUser();
        return;
      }
    }

    const backup = localStorage.getItem('visibility_session_backup');
    if (!backup) {
      checkFirstTimeUser();
      return;
    }
    
    const session = JSON.parse(backup);
    const age = Date.now() - session.timestamp;
    const maxAge = 24 * 60 * 60 * 1000;
    
    const validTabs = (session?.tabs || []).filter(t => t.url && t.url !== 'about:blank' && !t.url.startsWith('data:'));
    if (!validTabs.length || age > maxAge) {
      localStorage.removeItem('visibility_session_backup');
      checkFirstTimeUser();
      return;
    }
    
    showSessionRestoreModal(session);
    
  } catch (e) {
    console.error('Session restore failed:', e);
    checkFirstTimeUser();
  }
}

ipcRenderer.on('autofill-data', (e, data) => {
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  const safeEmail = JSON.stringify(data.email || '');
  tab.webview.executeJavaScript(`
    (function() {
      const emailVal = ${safeEmail};
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
      inputs.forEach(input => {
        const name = input.name || input.id || input.placeholder;
        if (name && name.toLowerCase().includes('email')) {
          input.value = emailVal;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    })();
  `).catch(() => {});
});

ipcRenderer.on('blocked-popup', (e, { url, fullUrl }) => {
  const t = window.t || ((k, f) => f || k);
  const container = document.getElementById('banner-container');
  if (!container) { toast(`🛑 Popup заблокирован: ${url}`); return; }

  const existing = document.getElementById('popup-blocked-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'popup-blocked-banner';
  banner.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-bright);border-radius:8px;padding:8px 14px;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-primary);box-shadow:0 4px 16px rgba(0,0,0,0.4);max-width:420px;';
  banner.innerHTML = `
    <span style="font-size:16px">🛑</span>
    <span style="flex:1">Popup заблокирован: <b>${url}</b></span>
    <button id="popup-allow-btn" style="padding:4px 10px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:11px;font-weight:600;">Открыть</button>
    <button id="popup-dismiss-btn" style="padding:4px 8px;border-radius:6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:13px;">✕</button>
  `;
  container.appendChild(banner);

  banner.querySelector('#popup-allow-btn').addEventListener('click', () => {
    if (fullUrl) ipcRenderer.send('allow-blocked-popup', fullUrl);
    banner.remove();
  });
  banner.querySelector('#popup-dismiss-btn').addEventListener('click', () => banner.remove());

  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
});

async function translatePage() {
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  try {
    await tab.webview.executeJavaScript(`
      (function() {
        if (window.location.hostname.includes('translate.google')) return;
        
        const text = document.body.innerText.substring(0, 1000);
        const url = 'https://translate.google.com/translate?sl=auto&tl=ru&u=' + encodeURIComponent(location.href);
        
        const bar = document.createElement('div');
        bar.id = 'visibility-translate-bar';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#2563eb;color:white;padding:10px;z-index:999999;text-align:center;font-family:sans-serif;font-size:14px;';
        bar.innerHTML = 'Перевод страницы... <a href="' + url + '" target="_blank" style="color:#bfdbfe;text-decoration:underline;">Открыть в Google Translate</a>';
        document.body.appendChild(bar);
        
        setTimeout(() => bar.remove(), 5000);
      })();
    `);
    
    showInfo(
      window.t ? window.t('translate-opened', 'Переводчик открыт') : 'Переводчик открыт',
      'Google Translate'
    );
  } catch (e) {
    console.error('Translation error:', e);
  }
}


async function toggleReaderMode() {
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  try {
    const isReaderMode = await tab.webview.executeJavaScript(`
      document.body.classList.contains('visibility-reader-mode')
    `);
    
    if (isReaderMode) {
      await tab.webview.executeJavaScript(`
        document.body.classList.remove('visibility-reader-mode');
        const style = document.getElementById('visibility-reader-style');
        if (style) style.remove();
      `);
      showInfo('Reader mode off');
    } else {
      await tab.webview.executeJavaScript(`
        (function() {
          document.body.classList.add('visibility-reader-mode');
          let style = document.getElementById('visibility-reader-style');
          if (!style) {
            style = document.createElement('style');
            style.id = 'visibility-reader-style';
            style.textContent = \`
              body.visibility-reader-mode nav, body.visibility-reader-mode header,
              body.visibility-reader-mode footer, body.visibility-reader-mode aside,
              body.visibility-reader-mode .ad, body.visibility-reader-mode .ads,
              body.visibility-reader-mode [role="banner"], body.visibility-reader-mode [role="navigation"] { display: none !important; }
              body.visibility-reader-mode { max-width: 720px; margin: 0 auto; padding: 48px 24px; font-size: 18px; line-height: 1.85; background: #fafafa; color: #1a1a1a; }
              body.visibility-reader-mode article, body.visibility-reader-mode main { display: block !important; max-width: 100%; }
              body.visibility-reader-mode img { max-width: 100%; height: auto; border-radius: 8px; }
              body.visibility-reader-mode p { margin: 0 0 1.2em; }
            \`;
            document.head.appendChild(style);
          }
          const target = document.querySelector('article, main, [role="main"]') || document.body;
          if (target !== document.body) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })();
      `);
      showInfo(window.t ? window.t('reader-on', 'Режим чтения включён') : 'Reader mode on');
    }
  } catch (e) {
    toast('Reader mode not available');
  }
}

async function takeScreenshot() {
  const tab = getActiveTab();
  if (!tab || !tab.webview) return;
  
  try {
    const image = await tab.webview.capturePage();
    const dataUrl = image.toDataURL();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `screenshot-${Date.now()}.png`;
    a.click();
    showSuccess(window.t ? window.t('screenshot-saved', 'Скриншот сохранен') : 'Скриншот сохранен');
  } catch (e) {
    showError('Screenshot failed');
  }
}

let perfMonitorActive = false;
function togglePerformanceMonitor() {
  perfMonitorActive = !perfMonitorActive;
  if (perfMonitorActive) {
    showInfo('Performance monitor enabled', 'FPS & Memory');
    updatePerformanceMonitor();
  } else {
    const monitor = document.getElementById('perf-monitor');
    if (monitor) monitor.remove();
  }
}

function updatePerformanceMonitor() {
  if (!perfMonitorActive) return;
  
  let monitor = document.getElementById('perf-monitor');
  if (!monitor) {
    monitor = document.createElement('div');
    monitor.id = 'perf-monitor';
    monitor.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.8);color:#00ff00;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:11px;z-index:9999;pointer-events:none;';
    document.body.appendChild(monitor);
  }
  
  const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'N/A';
  monitor.textContent = `RAM: ${memory}`;
  
  requestAnimationFrame(() => setTimeout(updatePerformanceMonitor, 1000));
}


