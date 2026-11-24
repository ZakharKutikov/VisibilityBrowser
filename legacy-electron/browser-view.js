'use strict';

const { WebContentsView } = require('electron');
const { matchShortcut } = require('./shortcuts-shared');

class BrowserViewManager {
  constructor(getMainWindow) {
    this.getMainWindow = getMainWindow;
    this.views = new Map();
  }

  _win() {
    return this.getMainWindow();
  }

  _emit(channel, payload) {
    const win = this._win();
    if (win && !win.isDestroyed()) {
      try { win.webContents.send(channel, payload); } catch (_) {}
    }
  }

  create(tabId, url, bounds, partition = 'persist:main') {
    this.destroy(tabId);
    const win = this._win();
    if (!win) return false;

    const view = new WebContentsView({
      webPreferences: {
        partition,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: true,
        backgroundThrottling: false,
        sandbox: false
      }
    });

    const wc = view.webContents;
    wc.on('render-process-gone', (e, details) => {
      console.warn('[BV] Render process gone:', details);
      try { wc.reload(); } catch (_) {}
    });

    wc.setWindowOpenHandler(({ url: targetUrl }) => {
      this._emit('open-new-tab', targetUrl);
      return { action: 'deny' };
    });

    wc.on('page-title-updated', (_, title) => {
      this._emit('bv-title', { tabId, title });
    });
    wc.on('did-navigate', (_, u) => {
      this._emit('bv-navigate', { tabId, url: u });
    });
    wc.on('did-navigate-in-page', (_, u) => {
      this._emit('bv-navigate', { tabId, url: u });
    });
    wc.on('did-start-loading', () => {
      this._emit('bv-loading', { tabId, loading: true });
    });
    wc.on('did-stop-loading', () => {
      this._emit('bv-loading', { tabId, loading: false });
    });
    wc.on('page-favicon-updated', (_, favicons) => {
      if (favicons && favicons[0]) {
        this._emit('bv-favicon', { tabId, favicon: favicons[0] });
      }
    });
    wc.on('media-started-playing', () => {
      this._emit('bv-media', { tabId, playing: true });
    });
    wc.on('media-paused', () => {
      this._emit('bv-media', { tabId, playing: false });
    });

    wc.on('before-input-event', (event, input) => {
      const action = matchShortcut(input);
      if (!action) return;
      event.preventDefault();
      this._emit('browser-shortcut', { action });
    });

    this.views.set(tabId, { view, visible: false });
    wc.loadURL(url).catch(err => console.warn('[BV] load failed:', err.message));
    return true;
  }

  hideAll() {
    const win = this._win();
    if (!win) return;
    for (const entry of this.views.values()) {
      if (entry.visible) {
        try { win.contentView.removeChildView(entry.view); } catch (_) {}
        entry.visible = false;
      }
    }
  }

  show(tabId, bounds) {
    const win = this._win();
    if (!win) return false;
    const entry = this.views.get(tabId);
    if (!entry) return false;

    this.hideAll();
    win.contentView.addChildView(entry.view);
    entry.view.setBounds(bounds);
    entry.visible = true;
    return true;
  }

  setBounds(tabId, bounds) {
    const entry = this.views.get(tabId);
    if (entry && entry.visible) {
      entry.view.setBounds(bounds);
    }
  }

  destroy(tabId) {
    const win = this._win();
    const entry = this.views.get(tabId);
    if (!entry) return;
    if (win && entry.visible) {
      try { win.contentView.removeChildView(entry.view); } catch (_) {}
    }
    try {
      entry.view.webContents.destroy();
    } catch (_) {}
    this.views.delete(tabId);
  }

  loadURL(tabId, url) {
    const entry = this.views.get(tabId);
    if (entry) entry.view.webContents.loadURL(url).catch(() => {});
  }

  reload(tabId) {
    const entry = this.views.get(tabId);
    if (entry) entry.view.webContents.reload();
  }

  stop(tabId) {
    const entry = this.views.get(tabId);
    if (entry) entry.view.webContents.stop();
  }

  goBack(tabId) {
    const entry = this.views.get(tabId);
    if (entry && entry.view.webContents.canGoBack()) {
      entry.view.webContents.goBack();
    }
  }

  goForward(tabId) {
    const entry = this.views.get(tabId);
    if (entry && entry.view.webContents.canGoForward()) {
      entry.view.webContents.goForward();
    }
  }

  setMuted(tabId, muted) {
    const entry = this.views.get(tabId);
    if (entry) entry.view.webContents.setAudioMuted(muted);
  }

  canGoBack(tabId) {
    const entry = this.views.get(tabId);
    return entry ? entry.view.webContents.canGoBack() : false;
  }

  canGoForward(tabId) {
    const entry = this.views.get(tabId);
    return entry ? entry.view.webContents.canGoForward() : false;
  }

  toggleDevTools(tabId) {
    const entry = this.views.get(tabId);
    if (!entry) return;
    const wc = entry.view.webContents;
    if (wc.isDevToolsOpened()) wc.closeDevTools();
    else wc.openDevTools();
  }

  destroyAll() {
    for (const tabId of [...this.views.keys()]) {
      this.destroy(tabId);
    }
  }
}

module.exports = BrowserViewManager;
