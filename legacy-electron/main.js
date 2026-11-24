const { app, BrowserWindow, ipcMain, session, Menu, dialog, shell, nativeTheme, desktopCapturer, globalShortcut, net, nativeImage } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const appID = 'com.gompstudios.visibility';
const APP_NAME = 'Visibility Browser';
app.setAppUserModelId(appID);
app.setName(APP_NAME);
if (process.platform === 'win32') process.title = APP_NAME;

function resolveAppIcon() {
  const candidates = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon.ico'];
  for (const name of candidates) {
    const filePath = path.join(__dirname, name);
    if (!fs.existsSync(filePath)) continue;
    const image = nativeImage.createFromPath(filePath);
    if (!image.isEmpty()) return image;
  }
  return undefined;
}

const APP_ICON = process.platform === 'win32'
  ? path.join(__dirname, 'icon.ico')
  : resolveAppIcon();

const VpnManager = require('./vpn-manager');
const BrowserViewManager = require('./browser-view');
const { applyAdBlocker } = require('./ad-blocker');
const { isGompTrustedDomain } = require('./gomp-trusted');
const { setupTabPerformance } = require('./tab-perf');
setupTabPerformance();

app.commandLine.appendSwitch('remote-debugging-port', '9333');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');

app.commandLine.appendSwitch('disable-zero-copy');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');

app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('enable-blink-features', 'GetUserMedia');

app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-webgl');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.commandLine.appendSwitch('enable-webrtc-hw-encoding');
app.commandLine.appendSwitch('enable-webrtc-hw-decoding');
app.commandLine.appendSwitch('enable-webrtc-stun-origin');

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer,V8CodeCache,WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('disable-features', 'TranslateUI,IsolatedWebApps,RendererCodeIntegrity');

console.log("VISIB Startup...", app.getVersion());

let windows = new Set();
let mainWindow;
let historyWindow;
let browserViews;
let vpn = null;
const activeDownloads = new Map();
let downloadListenerAttached = false;

const historyPath = path.join(app.getPath('userData'), 'history.json');
const bookmarksPath = path.join(app.getPath('userData'), 'bookmarks.json');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const sessionPath = path.join(app.getPath('userData'), 'last-session.json');

let browsing_history = [];
let bookmarks = [];
let sslWhitelist = new Set();
let settings = {
  homepage: 'https://www.google.com',
  searchEngine: 'https://www.google.com/search?q=',
  userAgentMode: 'chrome', // 'chrome' | 'custom'
  customUserAgent: '',
  showBookmarksBar: true,
  darkMode: true,
  zoomFactor: 1.0,
  adBlock: false,
  restoreSessionOnStartup: true,
  trustedDomains: [],
  checkUpdates: true,
  language: 'ru',
  vpnSubUrl: '',
  vpnRoutingMode: 'split-ru',
  vpnCustomBlocked: [],
  vpnAutoConnect: false,
};

function syncAdBlocker() {
  applyAdBlocker(session.fromPartition('persist:main'), !!settings.adBlock);
  applyAdBlocker(session.fromPartition('incognito'), !!settings.adBlock);
}

function parseChromeBookmarkTree(node, out) {
  if (!node) return;
  if (node.type === 'url' && node.url && !node.url.startsWith('javascript:')) {
    out.push({
      title: node.name || node.url,
      url: node.url,
      favicon: '',
      addedAt: new Date().toISOString(),
    });
  }
  if (Array.isArray(node.children)) node.children.forEach((child) => parseChromeBookmarkTree(child, out));
}

const permissionStates = {};
let permissionRequestId = 0;
const pendingPermissions = {};
const voiceDomains = ['discord.com', 'discordapp.com', 'discord.gg', 'discord.media', 'discordapp.net', 'meet.google.com', 'zoom.us', 'teams.microsoft.com', 'web.telegram.org', 'web.skype.com'];

function permHostFromOrigin(origin = '') {
  try { return new URL(origin).hostname; } catch (e) {
    return String(origin).replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  }
}

function permKey(host, permission) {
  return `${host}::${permission}`;
}

function isTrustedVoiceDomain(hostname = '') {
  if (!hostname) return false;
  return voiceDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function handlePermission(webContents, permission, callback, details) {
  let origin = '';
  try {
    origin = details && details.requestingUrl
      ? new URL(details.requestingUrl).hostname
      : new URL(webContents.getURL()).hostname;
  } catch (e) {}

  const dangerousPerms = ['openExternal'];
  if (dangerousPerms.includes(permission)) {
    callback(false);
    return;
  }

  const autoGrantPerms = ['clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'speaker-selection'];
  if (autoGrantPerms.includes(permission)) {
    callback(true);
    return;
  }

  const mediaPerms = ['media', 'microphone', 'camera', 'display-capture'];
  if (mediaPerms.includes(permission) && isTrustedVoiceDomain(origin)) {
    permissionStates[permKey(origin, permission)] = 'granted';
    callback(true);
    return;
  }

  const key = permKey(origin, permission);
  if (permissionStates[key] !== undefined) {
    callback(permissionStates[key] === 'granted');
    return;
  }

  const reqId = ++permissionRequestId;
  pendingPermissions[reqId] = { callback, key };

  if (mainWindow) {
    mainWindow.webContents.send('permission-request', { id: reqId, permission, origin });
  } else {
    callback(false);
  }
}

function handlePermissionCheck(_webContents, permission, requestingOrigin) {
  const host = permHostFromOrigin(requestingOrigin);
  const key = permKey(host, permission);
  if (permissionStates[key] === 'granted') return true;
  const safePerms = ['clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'speaker-selection'];
  if (safePerms.includes(permission)) return true;
  if (['media', 'microphone', 'camera', 'display-capture'].includes(permission) && isTrustedVoiceDomain(host)) {
    return true;
  }
  return false;
}
function setupDisplayMediaHandler(ses) {
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      callback(sources.length > 0 ? { video: sources[0], audio: 'loopback' } : {});
    }).catch(() => callback({}));
  });
}

function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { console.error('Load error:', filePath, e.message); }
  return fallback;
}

function saveJSON(filePath, data) {
  const tmp = filePath + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (e) {
    console.error('Save error:', filePath, e.message);
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

function loadAll() {
  browsing_history = loadJSON(historyPath, []);
  bookmarks = loadJSON(bookmarksPath, []);
  const saved = loadJSON(settingsPath, {});
  settings = { ...settings, ...saved };
  syncAdBlocker();
}

function dialogText(key) {
  const lang = settings.language === 'en' ? 'en' : 'ru';
  const strings = {
    ru: {
      crashTitle: 'Страница перестала отвечать',
      crashMsg: 'Вкладка перестала отвечать и будет перезагружена.',
      unresponsiveTitle: 'Браузер не отвечает',
      unresponsiveMsg: 'Браузер перестал отвечать. Перезагрузить?',
      reload: 'Перезагрузить',
      wait: 'Подождать',
      ok: 'OK',
      historyTitle: 'История и Закладки'
    },
    en: {
      crashTitle: 'Page stopped responding',
      crashMsg: 'The tab stopped responding and will be reloaded.',
      unresponsiveTitle: 'Browser not responding',
      unresponsiveMsg: 'The browser stopped responding. Reload?',
      reload: 'Reload',
      wait: 'Wait',
      ok: 'OK',
      historyTitle: 'History & Bookmarks'
    }
  };
  return (strings[lang] || strings.ru)[key];
}

function saveAll() {
  saveJSON(historyPath, browsing_history);
  saveJSON(bookmarksPath, bookmarks);
  saveJSON(settingsPath, settings);
}

let _historySaveTimer = null;
function debouncedSaveHistory() {
  if (_historySaveTimer) return;
  _historySaveTimer = setTimeout(() => {
    _historySaveTimer = null;
    saveJSON(historyPath, browsing_history);
  }, 5000);
}

function sha256File(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => resolve(null));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function createWindow(options = {}) {
  const { isIncognito = false, url = null } = options;

  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: isIncognito ? '#1a1a1c' : '#0d0d0d',
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      spellcheck: false,
      partition: isIncognito ? 'incognito' : 'persist:main',
      preloadURL: null,
      offscreen: false,
      sandbox: false
    },
    icon: APP_ICON,
    show: true,
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  if (!mainWindow && !isIncognito) mainWindow = win;

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init-incognito', isIncognito);
    if (url) win.webContents.send('load-url', url);
  });

  win.on('close', () => {
    if (win === mainWindow && browserViews) browserViews.destroyAll();
    windows.delete(win);
    if (win === mainWindow) mainWindow = null;
    saveAll();
    if (windows.size === 0) {
      if (vpn && typeof vpn.disconnect === 'function') {
        try { vpn.disconnect(); } catch (_) {}
      }
      app.quit();
      setTimeout(() => {
        try { app.exit(0); } catch (_) {}
      }, 250);
    }
  });

  win.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Shell render process gone:', details);
    if (details.reason === 'crashed' || details.reason === 'oom') {
      try { win.reload(); } catch (e) {}
    }
  });

  win.on('unresponsive', () => {
    console.warn('[Main] Window temporarily unresponsive (heavy computation or loading)');
  });
  win.on('responsive', () => {
    console.log('[Main] Window became responsive again');
  });

  windows.add(win);
  return win;
}

function createHistoryWindow() {
  if (historyWindow) {
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 500,
    height: 800,
    title: dialogText('historyTitle'),
    backgroundColor: '#1e1e20',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: APP_ICON,
    autoHideMenuBar: true
  });

  historyWindow.loadFile('history.html');

  historyWindow.on('closed', () => {
    historyWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const urlArg = commandLine.find(arg => arg.startsWith('http') || arg.includes('://') || arg.endsWith('.html') || arg.endsWith('.htm'));
      if (urlArg) {
        let finalUrl = urlArg;
        if (!urlArg.startsWith('http') && !urlArg.startsWith('file://')) {
          finalUrl = 'file:///' + urlArg.replace(/\\/g, '/');
        }
        mainWindow.webContents.send('open-new-tab', finalUrl);
      }
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'darwin' && APP_ICON) {
      app.dock.setIcon(APP_ICON);
    }

    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('http', process.execPath, [path.resolve(process.argv[1])]);
        app.setAsDefaultProtocolClient('https', process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient('http');
      app.setAsDefaultProtocolClient('https');
    }

    loadAll();

    let initialUrl = null;
    const argsToScan = process.argv.slice(1);
    const urlArg = argsToScan.find(arg => arg.startsWith('http') || arg.endsWith('.html') || arg.endsWith('.htm'));
    if (urlArg) {
      initialUrl = urlArg;
      if (!urlArg.startsWith('http') && !urlArg.startsWith('file://')) {
        initialUrl = 'file:///' + urlArg.replace(/\\/g, '/');
      }
    }

    createWindow({ url: initialUrl });

    app.on('activate', () => {
      if (windows.size === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    saveAll();
    globalShortcut.unregisterAll();
    if (vpn && typeof vpn.disconnect === 'function') {
      try { vpn.disconnect(); } catch (_) {}
    }
    app.quit();
    setTimeout(() => {
      try { app.exit(0); } catch (_) {}
    }, 250);
  });

  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();
      if (sslWhitelist.has(host) || sslWhitelist.has(parsedUrl.host.toLowerCase())) {
        callback(true);
        return;
      }

      // Automatically trust GOmp Studios ecosystem certificates & custom trustedDomains
      if (isGompTrustedDomain(url, settings.trustedDomains || [])) {
        callback(true);
        return;
      }

      const issuerOrg = String(certificate?.issuer?.organizationName || certificate?.issuer?.O || '').toLowerCase();
      const issuerCN = String(certificate?.issuer?.commonName || certificate?.issuer?.CN || '').toLowerCase();
      const subjectOrg = String(certificate?.subject?.organizationName || certificate?.subject?.O || '').toLowerCase();
      const subjectCN = String(certificate?.subject?.commonName || certificate?.subject?.CN || '').toLowerCase();
      const fp256 = String(certificate?.fingerprint || '').replace(/:/g, '').toLowerCase();

      if (
        issuerOrg.includes('gomp') ||
        issuerCN.includes('gomp') ||
        subjectOrg.includes('gomp') ||
        subjectCN.includes('gomp') ||
        fp256 === 'ca702dd597963a5d6ced2aabcd476707da9526ba6560721c5ec0cbfc30c931e9'
      ) {
        callback(true);
        return;
      }
    } catch (e) { }

    callback(false);
  });

  ipcMain.on('whitelist-ssl', (e, hostname) => {
    if (hostname) sslWhitelist.add(hostname.toLowerCase().trim());
  });

  ipcMain.on('minimize-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.minimize();
  });
  ipcMain.on('maximize-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
  });
  ipcMain.on('close-window', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
  });
  ipcMain.on('is-maximized', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) e.reply('maximized-status', win.isMaximized());
  });

  app.on('browser-window-created', (e, win) => {
    win.on('maximize', () => win.webContents.send('window-state-changed', true));
    win.on('unmaximize', () => win.webContents.send('window-state-changed', false));
  });

  ipcMain.on('add-to-history', (event, data) => {
    if (!data.incognito && data.url && !data.url.startsWith('about:') && !data.url.startsWith('file:') && !data.url.startsWith('data:')) {
      const now = Date.now();
      const idx = browsing_history.findIndex(
        (item) => item.url === data.url && now - new Date(item.timestamp).getTime() < 60000
      );
      if (idx !== -1) browsing_history.splice(idx, 1);
      browsing_history.unshift({
        url: data.url,
        title: data.title || 'Без названия',
        timestamp: new Date().toISOString(),
        displayTime: new Date().toLocaleString('ru-RU', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }),
      });
      if (browsing_history.length > 10000) browsing_history = browsing_history.slice(0, 10000);
      debouncedSaveHistory();
    }
  });

  ipcMain.on('search-history', (e, query) => {
    const q = query.toLowerCase();
    e.reply('history-data', browsing_history.filter(
      (i) => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
    ));
  });

  ipcMain.on('get-history', (e) => e.reply('history-data', browsing_history));

  ipcMain.on('get-history-specific', (e, channel) => {
    e.reply(channel, browsing_history);
  });

  ipcMain.on('search-history-specific', (e, { query, replyChannel }) => {
    const q = query.toLowerCase();
    e.reply(replyChannel, browsing_history.filter(
      (i) => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q)
    ));
  });

  ipcMain.handle('get-ntp-weather', async (event, customCity) => {
    try {
      let lat = null, lon = null, cityName = '';

      if (customCity) {
        try {
          const geoRes = await net.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(customCity)}&count=1&language=ru`).then(r => r.json());
          if (geoRes?.results?.length) {
            lat = geoRes.results[0].latitude;
            lon = geoRes.results[0].longitude;
            cityName = geoRes.results[0].name;
          }
        } catch (e) {}
      }

      if (!lat || !lon) {
        try {
          const resA = await net.fetch('https://ipwhois.app/json/?lang=ru').then(r => r.json());
          if (resA && resA.success) {
            lat = resA.latitude;
            lon = resA.longitude;
            cityName = resA.city || resA.region || '';
          }
        } catch (e) {}
      }

      if (!lat || !lon) {
        try {
          const resB = await net.fetch('http://ip-api.com/json/?lang=ru').then(r => r.json());
          if (resB && resB.status === 'success') {
            lat = resB.lat;
            lon = resB.lon;
            cityName = resB.city || resB.regionName || '';
          }
        } catch (e) {}
      }

      if (!lat || !lon) {
        try {
          const resC = await net.fetch('https://wttr.in/?format=j1').then(r => r.json());
          if (resC?.nearest_area?.length) {
            const area = resC.nearest_area[0];
            cityName = area.areaName?.[0]?.value || area.region?.[0]?.value || '';
            const tempC = parseInt(resC.current_condition?.[0]?.temp_C || '0', 10);
            const descRu = resC.current_condition?.[0]?.lang_ru?.[0]?.value || resC.current_condition?.[0]?.weatherDesc?.[0]?.value || 'Погода';
            return { temp: tempC, desc: descRu, city: cityName, code: 0 };
          }
        } catch (e) {}
      }

      if (!lat || !lon) {
        lat = 55.75;
        lon = 37.62;
        cityName = 'Москва (авто)';
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
      const data = await net.fetch(weatherUrl).then(r => r.json());
      if (data?.current) {
        return {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
          city: cityName
        };
      }
    } catch (e) {
      console.error('NTP Weather fetch error:', e.message);
    }
    return null;
  });

  ipcMain.on('clear-history', (e) => {
    browsing_history = [];
    saveJSON(historyPath, browsing_history);
    session.fromPartition('persist:main').clearStorageData();
    e.reply('history-cleared');
  });

  ipcMain.on('clear-history-period', (e, period) => {
    const now = Date.now();
    const durations = { hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 };
    const cutoff = now - (durations[period] || 0);
    browsing_history = browsing_history.filter(
      (item) => new Date(item.timestamp).getTime() < cutoff
    );
    saveJSON(historyPath, browsing_history);
    e.reply('history-cleared');
  });

  ipcMain.on('delete-history-item', (e, url) => {
    browsing_history = browsing_history.filter((i) => i.url !== url);
    saveJSON(historyPath, browsing_history);
    e.reply('history-data', browsing_history);
  });

  ipcMain.on('get-bookmarks', (e) => e.reply('bookmarks-data', bookmarks));

  ipcMain.on('add-bookmark', (e, bm) => {
    if (!bookmarks.find((b) => b.url === bm.url)) {
      bookmarks.unshift({ url: bm.url, title: bm.title || bm.url, favicon: bm.favicon || '', addedAt: new Date().toISOString() });
      saveJSON(bookmarksPath, bookmarks);
    }
    e.reply('bookmarks-data', bookmarks);
  });

  ipcMain.on('remove-bookmark', (e, url) => {
    bookmarks = bookmarks.filter((b) => b.url !== url);
    saveJSON(bookmarksPath, bookmarks);
    e.reply('bookmarks-data', bookmarks);
  });

  ipcMain.on('is-bookmarked', (e, url) => {
    e.reply('bookmark-status', !!bookmarks.find((b) => b.url === url));
  });

  ipcMain.handle('get-bookmarks-data', () => bookmarks);

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.on('import-bookmarks', (e, importedBookmarks) => {
    if (Array.isArray(importedBookmarks)) {
      importedBookmarks.forEach(bm => {
        if (!bookmarks.find(b => b.url === bm.url)) {
          bookmarks.unshift({
            url: bm.url,
            title: bm.title || bm.url,
            favicon: bm.favicon || '',
            addedAt: bm.addedAt || new Date().toISOString()
          });
        }
      });
      saveJSON(bookmarksPath, bookmarks);
    }
    e.reply('bookmarks-data', bookmarks);
  });

  ipcMain.handle('export-bookmarks', () => bookmarks);

  ipcMain.on('get-settings', (e) => {
    e.reply('settings-data', settings);
  });

  ipcMain.handle('get-settings-data', () => settings);

  ipcMain.on('import-settings', (e, importedSettings) => {
    if (importedSettings && typeof importedSettings === 'object') {
      settings = { ...settings, ...importedSettings };
      saveJSON(settingsPath, settings);
      for (const w of windows) {
        w.webContents.send('settings-saved', settings);
        w.webContents.send('settings-data', settings);
      }
    }
  });

  ipcMain.on('save-settings', async (e, newSettings) => {
    const prevRouting = settings.vpnRoutingMode;
    const prevCustom = JSON.stringify(settings.vpnCustomBlocked || []);
    settings = { ...settings, ...newSettings };
    saveJSON(settingsPath, settings);
    syncAdBlocker();
    const ua = settings.userAgentMode === 'custom' && settings.customUserAgent
      ? settings.customUserAgent
      : `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 VisibilityBrowser/2.1.0`;
    session.fromPartition('persist:main').setUserAgent(ua);

    if (vpn) {
      syncVpnFromSettings();
      if (typeof newSettings.vpnSubUrl === 'string') {
        vpn.subUrl = newSettings.vpnSubUrl.trim();
        vpn._save();
      }
      const routingChanged = prevRouting !== settings.vpnRoutingMode
        || prevCustom !== JSON.stringify(settings.vpnCustomBlocked || []);
      if (routingChanged && vpn.connected) {
        try { await vpn.reconnect(getSessions()); } catch (ex) { }
      }
    }

    for (const w of windows) {
      w.webContents.send('settings-saved', settings);
      w.webContents.send('settings-data', settings);
    }
  });

  ipcMain.on('save-session', (e, data) => {
    if (data && Array.isArray(data.tabs)) saveJSON(sessionPath, data);
  });

  ipcMain.handle('get-last-session', () => loadJSON(sessionPath, null));

  ipcMain.handle('import-chrome-bookmarks', async () => {
    const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
    const chromePath = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks');
    if (!fs.existsSync(chromePath)) {
      return { ok: false, error: 'not_found', count: 0 };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(chromePath, 'utf8'));
      const found = [];
      parseChromeBookmarkTree(raw.roots?.bookmark_bar, found);
      parseChromeBookmarkTree(raw.roots?.other, found);
      parseChromeBookmarkTree(raw.roots?.synced, found);
      let added = 0;
      found.forEach((bm) => {
        if (!bookmarks.some((b) => b.url === bm.url)) {
          bookmarks.push(bm);
          added++;
        }
      });
      if (added) saveJSON(bookmarksPath, bookmarks);
      return { ok: true, count: added, total: found.length };
    } catch (err) {
      return { ok: false, error: err.message, count: 0 };
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    const current = app.getVersion();
    const result = { current, latest: null, updateAvailable: false, url: 'https://gomp.su', notes: '', downloadUrl: '' };
    try {
      const body = await new Promise((resolve, reject) => {
        const req = net.request('https://raw.githubusercontent.com/ZakharKutikov/VisibilityBrowser/main/latest.json');
        let data = '';
        req.on('response', (res) => {
          res.on('data', (chunk) => { data += chunk.toString(); });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
      });
      const data = JSON.parse(body);
      if (data && data.version) {
        result.latest = data.version;
        result.updateAvailable = data.version !== current;
        if (data.url) result.url = data.url;
        if (data.notes) result.notes = data.notes;
        if (data.downloadUrl) result.downloadUrl = data.downloadUrl;
      }
    } catch (e) {
      result.error = 'unavailable';
    }
    return result;
  });

  ipcMain.on('open-external-url', (e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  ipcMain.on('patch-setting', (e, patch) => {
    if (patch && typeof patch === 'object') {
      settings = { ...settings, ...patch };
      saveJSON(settingsPath, settings);
      for (const w of windows) {
        w.webContents.send('settings-data', settings);
      }
    }
  });

  ipcMain.on('clear-cookies', (e) => {
    Promise.all([
      session.fromPartition('persist:main').clearStorageData(),
      session.fromPartition('persist:main').clearCache(),
    ]).then(() => e.reply('cookies-cleared'));
  });

  ipcMain.on('setup-download-listener', () => {
    if (downloadListenerAttached) return;
    downloadListenerAttached = true;
    const downloadSession = session.fromPartition('persist:main');

    downloadSession.on('will-download', (event, item) => {
      const suggestedName = item.getFilename();
      const ext = path.extname(suggestedName);
      let baseName = path.basename(suggestedName, ext);
      let savePath = path.join(app.getPath('downloads'), suggestedName);
      let counter = 1;

      while (fs.existsSync(savePath)) {
        savePath = path.join(app.getPath('downloads'), `${baseName} (${counter})${ext}`);
        counter++;
      }

      item.setSavePath(savePath);

      const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeDownloads.set(downloadId, item);

      mainWindow.webContents.send('download-started', {
        id: downloadId,
        filename: path.basename(savePath),
        extension: path.extname(savePath).replace('.', '').toLowerCase(),
        totalBytes: item.getTotalBytes(),
        url: item.getURL(),
      });

      item.on('updated', (event, state) => {
        if (state === 'progressing') {
          mainWindow.webContents.send('download-progress', {
            id: downloadId,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes(),
            speed: item.getCurrentBytesPerSecond ? item.getCurrentBytesPerSecond() : 0,
            paused: item.isPaused ? item.isPaused() : false,
          });
        } else if (state === 'interrupted') {
          mainWindow.webContents.send('download-state', {
            id: downloadId,
            state: item.isPaused && item.isPaused() ? 'paused' : 'interrupted',
          });
        }
      });

      item.once('done', async (event, state) => {
        activeDownloads.delete(downloadId);
        const checksum = state === 'completed' && fs.existsSync(savePath)
          ? await sha256File(savePath)
          : null;
        mainWindow.webContents.send('download-done', {
          id: downloadId,
          state,
          savePath,
          filename: path.basename(savePath),
          checksum,
        });
      });
    });
  });

  ipcMain.on('download-pause', (e, id) => {
    const item = activeDownloads.get(id);
    if (!item) return;
    try {
      if (!item.isPaused || !item.isPaused()) item.pause();
      e.sender.send('download-state', { id, state: 'paused' });
    } catch (_) {}
  });

  ipcMain.on('download-resume', (e, id) => {
    const item = activeDownloads.get(id);
    if (!item) return;
    try {
      if (!item.canResume || item.canResume()) item.resume();
      e.sender.send('download-state', { id, state: 'progressing' });
    } catch (_) {}
  });

  ipcMain.on('download-cancel', (e, id) => {
    const item = activeDownloads.get(id);
    if (!item) return;
    try {
      item.cancel();
      e.sender.send('download-state', { id, state: 'cancelled' });
    } catch (_) {}
  });

  ipcMain.on('download-retry', (e, url) => {
    if (!url) return;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
    try {
      session.fromPartition('persist:main').downloadURL(url);
    } catch (_) {}
  });

  ipcMain.on('open-file', (e, filePath) => {
    shell.openPath(filePath);
  });

  ipcMain.on('show-in-folder', (e, filePath) => {
    shell.showItemInFolder(filePath);
  });

  app.whenReady().then(() => {
    const incognitoSession = session.fromPartition('incognito', { cache: false });
    incognitoSession.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 VisibilityBrowser/2.1.0'
    );
  });

  ipcMain.on('show-tab-context-menu', (e, { id }) => {
    if (!id) return;

    const template = [
      { label: 'Дублировать вкладку', click: () => e.sender.send('duplicate-tab', id) },
      { type: 'separator' },
      { label: 'Закрыть вкладку', click: () => e.sender.send('close-tab', id) },
      { label: 'Закрыть вкладки справа', click: () => e.sender.send('close-tabs-to-right', id) },
      { label: 'Закрыть другие вкладки', click: () => e.sender.send('close-other-tabs', id) },
      { label: 'Закрыть все вкладки', click: () => e.sender.send('close-all-tabs') },
    ];

    const menu = Menu.buildFromTemplate(template);
    const senderWindow = BrowserWindow.fromWebContents(e.sender) || mainWindow;
    menu.popup({ window: senderWindow });
  });

  ipcMain.on('show-context-menu', (e, params) => {
    const template = [];

    if (params.linkURL) {
      template.push(
        { label: 'Открыть ссылку в новой вкладке', click: () => e.sender.send('open-url-in-new-tab', params.linkURL) },
        { label: 'Копировать ссылку', click: () => require('electron').clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    if (params.mediaType === 'image') {
      template.push(
        { label: 'Сохранить изображение', click: () => e.sender.send('download-image', params.srcURL) },
        { label: 'Копировать URL изображения', click: () => require('electron').clipboard.writeText(params.srcURL) },
        { label: 'Картинка в картинке', click: () => e.sender.send('pip-image', params.srcURL) },
        { type: 'separator' },
      );
    }

    if (params.mediaType === 'video' || params.mediaType === 'audio') {
      template.push(
        { label: 'Картинка в картинке', click: () => e.sender.send('trigger-pip') },
        { type: 'separator' },
      );
    }

    if (params.selectionText) {
      template.push(
        { label: 'Копировать', role: 'copy' },
        {
          label: `Найти "${params.selectionText.slice(0, 20)}${params.selectionText.length > 20 ? '…' : ''}"`,
          click: () => e.sender.send('search-selected', params.selectionText)
        },
        { type: 'separator' },
      );
    }

    template.push(
      { label: 'Сохранить страницу как...', click: () => e.sender.send('save-page') },
      { label: 'Просмотр кода страницы', click: () => e.sender.send('view-source') },
      { label: 'Инспектировать элемент', click: () => e.sender.send('inspect-element', { x: params.x, y: params.y }) },
      { type: 'separator' },
      { label: 'Обновить страницу', click: () => e.sender.send('reload-page') },
    );

    const menu = Menu.buildFromTemplate(template);
    const senderWindow = BrowserWindow.fromWebContents(e.sender) || mainWindow;
    menu.popup({ window: senderWindow });
  });

  ipcMain.on('set-zoom', (e, factor) => {
    settings.zoomFactor = factor;
    saveJSON(settingsPath, settings);
  });

  ipcMain.handle('get-certificate-info', async (event, url) => {
    if (!url || !url.startsWith('https://')) return null;

    return new Promise((resolve) => {
      const request = require('https').request(url, { method: 'HEAD', rejectUnauthorized: false }, (res) => {
        const cert = res.socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          resolve(null);
          return;
        }
        resolve({
          subject: cert.subject,
          issuer: cert.issuer,
          valid_from: cert.valid_from,
          valid_to: cert.valid_to,
          fingerprint: cert.fingerprint256 || cert.fingerprint,
          protocol: res.socket.getProtocol()
        });
      });
      request.on('error', () => resolve(null));
      request.end();
      setTimeout(() => resolve(null), 3000);
    });
  });

  ipcMain.on('force-download-url', (e, url) => {
    if (url) mainWindow.webContents.downloadURL(url);
  });

  ipcMain.on('allow-blocked-popup', (e, targetUrl) => {
    if (!targetUrl) return;
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_) {
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return;

    const popup = new BrowserWindow({
      width: 900,
      height: 700,
      parent: mainWindow || undefined,
      show: false,
      autoHideMenuBar: true,
      icon: APP_ICON,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      }
    });

    popup.once('ready-to-show', () => popup.show());
    popup.loadURL(targetUrl).catch(() => {
      try { popup.destroy(); } catch (_) {}
    });
  });

  ipcMain.on('mute-webcontents', (e, wcId, muted) => {
    const { webContents } = require('electron');
    const wc = webContents.fromId(wcId);
    if (wc) wc.setAudioMuted(muted);
  });

  ipcMain.on('open-history-window', () => createHistoryWindow());
  ipcMain.on('open-incognito-window', () => createWindow({ isIncognito: true }));

  ipcMain.on('open-voice-window', (e, url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return;

    const voiceWin = new BrowserWindow({
      width: 1280,
      height: 900,
      title: parsed.hostname + ' (Voice/Video)',
      webPreferences: {
        partition: 'persist:main',
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      icon: APP_ICON
    });
    const voiceSes = session.fromPartition('persist:main');
    voiceSes.setPermissionRequestHandler(handlePermission);
    voiceSes.setPermissionCheckHandler(handlePermissionCheck);
    voiceWin.loadURL(url);
    voiceWin.once('ready-to-show', () => voiceWin.show());
  });

  browserViews = new BrowserViewManager(() => mainWindow);

  ipcMain.handle('bv-create', (e, { tabId, url, bounds, partition }) => {
    return browserViews.create(tabId, url, bounds, partition || 'persist:main');
  });

  ipcMain.on('bv-show', (e, { tabId, bounds }) => {
    browserViews.show(tabId, bounds);
  });

  ipcMain.on('bv-hide-all', () => {
    browserViews.hideAll();
  });

  ipcMain.on('bv-bounds', (e, { tabId, bounds }) => {
    browserViews.setBounds(tabId, bounds);
  });

  ipcMain.on('bv-destroy', (e, tabId) => {
    browserViews.destroy(tabId);
  });

  ipcMain.handle('bv-load', (e, { tabId, url }) => {
    browserViews.loadURL(tabId, url);
    return true;
  });

  ipcMain.on('bv-reload', (e, tabId) => browserViews.reload(tabId));
  ipcMain.on('bv-stop', (e, tabId) => browserViews.stop(tabId));
  ipcMain.on('bv-go-back', (e, tabId) => browserViews.goBack(tabId));
  ipcMain.on('bv-go-forward', (e, tabId) => browserViews.goForward(tabId));
  ipcMain.on('bv-set-muted', (e, { tabId, muted }) => browserViews.setMuted(tabId, muted));
  ipcMain.handle('bv-can-go-back', (e, tabId) => browserViews.canGoBack(tabId));
  ipcMain.handle('bv-can-go-forward', (e, tabId) => browserViews.canGoForward(tabId));
  ipcMain.on('bv-devtools', (e, tabId) => browserViews.toggleDevTools(tabId));

  ipcMain.on('open-url-in-main', (e, url) => {
    if (mainWindow && url) {
      mainWindow.webContents.send('load-url', url);
      mainWindow.focus();
      if (historyWindow) historyWindow.close();
    }
  });

  function syncVpnFromSettings() {
    if (!vpn) return;
    const custom = Array.isArray(settings.vpnCustomBlocked)
      ? settings.vpnCustomBlocked
      : String(settings.vpnCustomBlocked || '').split('\n').map(s => s.trim()).filter(Boolean);
    vpn.setOptions({
      routingMode: settings.vpnRoutingMode === 'full' ? 'full' : 'split-ru',
      customBlockedDomains: custom,
    });
  }

  function mergeVpnSubFromSettings() {
    if (!vpn) return;
    if (settings.vpnSubUrl && !vpn.subUrl) {
      vpn.subUrl = settings.vpnSubUrl;
      vpn._save();
    } else if (vpn.subUrl && !settings.vpnSubUrl) {
      settings.vpnSubUrl = vpn.subUrl;
      saveJSON(settingsPath, settings);
    }
  }

  app.whenReady().then(async () => {
    if (!vpn) {
      vpn = new VpnManager(app.getPath('userData'));
      vpn.on('status', (status) => {
        for (const w of windows) {
          try { w.webContents.send('vpn-status', status); } catch (e) { }
        }
      });
      mergeVpnSubFromSettings();
      syncVpnFromSettings();

      if (settings.vpnAutoConnect && vpn.hasBinary() && vpn.servers.length) {
        setTimeout(async () => {
          if (!vpn || vpn.connected) return;
          const idx = Math.min(Math.max(0, settings.vpnAutoConnectServerIndex || 0), vpn.servers.length - 1);
          try { await vpn.connect(vpn.servers[idx], getSessions()); } catch (e) { }
        }, 2500);
      }
    }
  });

  function getSessions() {
    const list = [session.defaultSession, session.fromPartition('persist:main'), session.fromPartition('incognito')];
    const seen = new Set();
    return list.filter(s => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }

  ipcMain.handle('get-vpn-status', () => {
    if (!vpn) return { connected: false, servers: [], hasBinary: false };
    return vpn.getStatus();
  });

  ipcMain.handle('vpn-fetch-sub', async (e, url) => {
    try {
      const servers = await vpn.fetchSub(url);
      if (url) {
        settings.vpnSubUrl = url;
        saveJSON(settingsPath, settings);
      }
      return { ok: true, servers };
    }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('vpn-add-link', (e, link) => {
    try { return { ok: true, added: vpn.addLink(link), servers: vpn.getStatus().servers }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('vpn-remove-server', (e, idx) => {
    vpn.removeServer(idx);
    return vpn.getStatus();
  });

  ipcMain.handle('vpn-connect', async (e, idx) => {
    try {
      const server = vpn.servers[idx];
      if (!server) return { ok: false, error: 'Server not found' };
      await vpn.connect(server, getSessions());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message === 'NO_BINARY' ? 'Xray core not found. Please download.' : err.message };
    }
  });

  ipcMain.handle('vpn-disconnect', async () => {
    try { await vpn.disconnect(getSessions()); return { ok: true }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('vpn-ping-servers', async () => {
    if (!vpn) return {};
    return await vpn.pingAllServers();
  });

  ipcMain.handle('vpn-set-routing-mode', async (e, mode) => {
    if (!vpn) return { ok: false };
    const validMode = mode === 'full' ? 'full' : 'split-ru';
    settings.vpnRoutingMode = validMode;
    saveJSON(settingsPath, settings);
    vpn.setOptions({ routingMode: validMode });
    if (vpn.connected) {
      try { await vpn.reconnect(getSessions()); } catch(e) {}
    }
    return { ok: true, status: vpn.getStatus() };
  });

  ipcMain.handle('vpn-test-connection', async () => {
    try {
      const res = await net.fetch('https://ipapi.co/json/', { timeout: 4000 });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, ip: data.ip, country: data.country_name, city: data.city, org: data.org };
      }
    } catch(e) {}
    try {
      const res = await net.fetch('https://api.ipify.org?format=json', { timeout: 4000 });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, ip: data.ip };
      }
    } catch(e) {}
    return { ok: false, error: 'Connection test failed' };
  });

  ipcMain.handle('vpn-download-binary', async (e) => {
    try {
      await vpn.downloadBinary((pct) => {
        try { e.sender.send('vpn-download-progress', pct); } catch (ex) { }
      });
      return { ok: true, hasBinary: vpn.hasBinary() };
    } catch (err) { return { ok: false, error: err.message }; }
  });


  ipcMain.on('get-user-data-path-sync', (e) => {
    e.returnValue = app.getPath('userData');
  });

  ipcMain.handle('show-ext-open-dialog', async () => {
    return await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Visibility Extensions', extensions: ['visibility'] }]
    });
  });

  ipcMain.handle('get-cookies', async (e, filter) => {
    return await session.fromPartition('persist:main').cookies.get(filter || {});
  });

  ipcMain.handle('set-cookie', async (e, details) => {
    return await session.fromPartition('persist:main').cookies.set(details);
  });

  ipcMain.handle('remove-cookie', async (e, { url, name }) => {
    return await session.fromPartition('persist:main').cookies.remove(url, name);
  });

  ipcMain.on('get-app-version', (e) => {
    e.returnValue = app.getVersion();
  });

  ipcMain.on('get-path', (e, name) => {
    try { e.returnValue = app.getPath(name); } catch (err) { e.returnValue = null; }
  });

  ipcMain.on('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.on('set-fullscreen', (e, val) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.setFullScreen(!!val);
  });

  ipcMain.handle('is-default-browser', async () => {
    return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
  });

  ipcMain.handle('set-as-default-browser', async () => {
    const exePath = process.execPath;
    const appName = "Visibility Browser";
    const appId = "com.gompstudios.visibility";

    let results = [];

    const protocols = ['http', 'https', 'mailto'];
    for (const proto of protocols) {
      let success = false;
      if (process.defaultApp) {
        const args = [path.resolve(process.argv[1])];
        success = app.setAsDefaultProtocolClient(proto, exePath, args);
      } else {
        success = app.setAsDefaultProtocolClient(proto);
      }
      results.push(success);
    }

    if (process.platform === 'win32') {
      try {
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM" /ve /d "Visibility HTML Document" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM" /v "FriendlyAppName" /d "${appName}" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM" /v "URL Protocol" /d "" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM\\DefaultIcon" /ve /d "${exePath},0" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM\\Application" /v "ApplicationName" /d "${appName}" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM\\Application" /v "ApplicationDescription" /d "GOmp Studios Browser" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM\\Application" /v "ApplicationIcon" /d "${exePath},0" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\VisibilityHTM\\shell\\open\\command" /ve /d "\\"${exePath}\\" \\"%1\\"" /f`);

        const startMenuKey = `HKCU\\Software\\Clients\\StartMenuInternet\\${appId}`;
        exec(`reg add "${startMenuKey}" /ve /d "${appName}" /f`);
        exec(`reg add "${startMenuKey}\\DefaultIcon" /ve /d "${exePath},0" /f`);
        exec(`reg add "${startMenuKey}\\Capabilities" /v "ApplicationName" /d "${appName}" /f`);
        exec(`reg add "${startMenuKey}\\Capabilities" /v "ApplicationDescription" /d "Modern browser by GOmp Studios" /f`);
        exec(`reg add "${startMenuKey}\\Capabilities" /v "ApplicationIcon" /d "${exePath},0" /f`);
        exec(`reg add "${startMenuKey}\\Capabilities\\URLAssociations" /v "http" /d "VisibilityHTM" /f`);
        exec(`reg add "${startMenuKey}\\Capabilities\\URLAssociations" /v "https" /d "VisibilityHTM" /f`);
        exec(`reg add "${startMenuKey}\\shell\\open\\command" /ve /d "\\"${exePath}\\"" /f`);

        exec(`reg add "HKCU\\Software\\Classes\\http" /v "FriendlyAppName" /d "${appName}" /f`);
        exec(`reg add "HKCU\\Software\\Classes\\https" /v "FriendlyAppName" /d "${appName}" /f`);

        exec(`reg add "HKCU\\Software\\RegisteredApplications" /v "${appName}" /d "Software\\Clients\\StartMenuInternet\\${appId}\\Capabilities" /f`);

        console.log("[MAIN] Extreme Registry Registration completed");
      } catch (e) {
        console.error("[MAIN] Registry injection failed:", e);
      }

      setTimeout(() => {
        shell.openExternal('ms-settings:defaultapps');
      }, 500);
    }

    return results.every(r => r === true);
  });

  const OAUTH_PATTERNS = [
    /\/oauth/i, /\/auth\//i, /[?&]client_id=/i, /\/authorize/i,
    /[?&]response_type=/i, /\/signin/i, /\/login/i, /\/connect\//i,
    /\/sso/i, /\/account\//i, /\/session/i, /\/callback/i,
    /secure\.soundcloud\.com/i, /soundcloud\.com/i, /accounts\.google\.com/i
  ];

  app.on('web-contents-created', (event, contents) => {
    if (contents.getType() === 'webview') {
      try {
        contents.on('render-process-gone', (event, details) => {
          console.warn('[Webview] Render process gone:', details);
          if (details.reason !== 'clean-exit') {
            for (const w of windows) {
              try { w.webContents.send('guest-render-gone', { guestId: contents.id, reason: details.reason }); } catch (e) {}
            }
          }
        });
      } catch (e) {}
    }

    contents.setWindowOpenHandler(({ url, disposition, features, referrer }) => {
      const refUrl = (referrer && referrer.url) ? referrer.url : '';
      const isOAuth = OAUTH_PATTERNS.some(p => p.test(url)) || OAUTH_PATTERNS.some(p => p.test(refUrl));
      const isAboutBlankPopup = typeof url === 'string' && url.startsWith('about:blank');
      if (isOAuth || isAboutBlankPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            icon: APP_ICON
          }
        };
      }

      if (mainWindow && url && url !== 'about:blank') {
        mainWindow.webContents.send('open-new-tab', url);
      }
      return { action: 'deny' };
    });

    contents.on('will-navigate', (e, url) => {
      if (contents.getType() === 'webview') return; // webview navigates normally
      if (!mainWindow || contents !== mainWindow.webContents) return; // allow popup/browser windows

      if (!url.startsWith('file://') && !url.startsWith('data:')) {
        e.preventDefault();
        mainWindow.webContents.send('open-new-tab', url);
      }
    });

  });

  ipcMain.on('reset-permissions', () => {
    for (const key of Object.keys(permissionStates)) {
      delete permissionStates[key];
    }
  });

  ipcMain.on('permission-response', (e, { id, granted }) => {
    const pending = pendingPermissions[id];
    if (!pending) return;
    delete pendingPermissions[id];
    permissionStates[pending.key] = granted ? 'granted' : 'denied';
    pending.callback(granted);
  });

  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 320, height: 180 }
      });
      return sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL()
      }));
    } catch (e) {
      console.error('Failed to get desktop sources:', e);
      return [];
    }
  });

  app.on('child-process-gone', (event, details) => {
    console.warn('[Process] Child process gone:', details.type, details.reason, 'exitCode:', details.exitCode);
  });



  app.whenReady().then(() => {
    const mainSes = session.fromPartition('persist:main');
    const incognitoSes = session.fromPartition('incognito', { cache: false });

    const defaultChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 VisibilityBrowser/2.1.0';
    const ua = settings.userAgentMode === 'custom' && settings.customUserAgent
      ? settings.customUserAgent
      : defaultChromeUA;

    mainSes.setUserAgent(ua);
    session.defaultSession.setUserAgent(ua);
    incognitoSes.setUserAgent(ua);

    mainSes.setPermissionRequestHandler(handlePermission);
    setupDisplayMediaHandler(mainSes);
    mainSes.setPermissionCheckHandler(handlePermissionCheck);

    incognitoSes.setPermissionRequestHandler(handlePermission);
    setupDisplayMediaHandler(incognitoSes);
    incognitoSes.setPermissionCheckHandler(handlePermissionCheck);

    syncAdBlocker();
  });
}