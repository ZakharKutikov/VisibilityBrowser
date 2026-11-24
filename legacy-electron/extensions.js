"use strict";

(function() {
  const fs = require('fs');
  const path = require('path');
  const { ipcRenderer, shell } = require('electron');

  const userDataPath = ipcRenderer.sendSync('get-user-data-path-sync');
  const extDir = path.join(userDataPath, 'extensions');
  if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });

  window.visibExt = {
    active: [],
    registry: new Map(),
    permissions: ['tabs', 'storage', 'notifications', 'clipboard', 'downloads']
  };

  const loadStorage = () => {
    try {
      const s = localStorage.getItem('visib_ext_storage');
      return s ? JSON.parse(s) : {};
    } catch(e) { return {}; }
  };
  window.visibExt.storage = loadStorage();

  const saveStorage = () => {
    localStorage.setItem('visib_ext_storage', JSON.stringify(window.visibExt.storage));
  };

  function createExtApi(extId) {
    return {
      addButton: (icon, title, onClick, options = {}) => {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        
        let extContainer = document.getElementById('ext-nav-container');
        if (!extContainer) {
          extContainer = document.createElement('div');
          extContainer.id = 'ext-nav-container';
          extContainer.style.display = 'flex';
          extContainer.style.alignItems = 'center';
          extContainer.style.gap = '4px';
          extContainer.style.marginRight = '4px';
          extContainer.style.marginLeft = '4px';
          const divider = navbar.querySelector('.nav-divider') || document.getElementById('btn-bookmark') || document.getElementById('btn-extensions');
          if (divider && divider.parentNode === navbar) {
            navbar.insertBefore(extContainer, divider);
          } else {
            navbar.appendChild(extContainer);
          }
        }
        
        const btnId = `ext-btn-${extId}-${Date.now()}`;
        const btn = document.createElement('button');
        btn.id = btnId;
        btn.className = 'nav-btn ext-nav-btn';
        btn.title = title;
        btn.style.width = '28px';
        btn.style.height = '28px';
        btn.style.fontSize = '14px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.background = 'rgba(255, 255, 255, 0.04)';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        btn.style.color = 'var(--text-primary)';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '8px';
        btn.style.transition = 'all 0.18s cubic-bezier(0.32, 0.72, 0, 1)';
        
        if (icon.startsWith('http') || icon.startsWith('data:image') || icon.startsWith('/')) {
          const img = document.createElement('img');
          img.src = icon;
          img.style.width = '16px';
          img.style.height = '16px';
          img.style.objectFit = 'contain';
          img.onerror = () => { btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 14h.01"/><path d="M12 10h.01"/></svg>'; };
          btn.appendChild(img);
        } else {
          btn.innerHTML = icon || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 14h.01"/><path d="M12 10h.01"/></svg>';
        }
        
        if (options.badge) {
          const badge = document.createElement('span');
          badge.className = 'ext-badge';
          badge.textContent = options.badge;
          badge.style.cssText = `
            position: absolute; top: 2px; right: 2px;
            background: var(--danger); color: white;
            font-size: 9px; min-width: 12px; height: 12px;
            border-radius: 6px; display: flex; align-items: center;
            justify-content: center; font-weight: 700;
          `;
          btn.style.position = 'relative';
          btn.appendChild(badge);
        }
        
        btn.onclick = (e) => {
          e.stopPropagation();
          if (!options.keepOpen) {
            const drop = document.getElementById('extensions-dropdown');
            if (drop) drop.classList.remove('show');
          }
          try {
            onClick(e);
          } catch (err) {
            console.error(`Extension ${extId} button error:`, err);
            api.toast(`Error: ${err.message}`);
          }
        };
        
        btn.onmouseenter = () => {
          btn.style.background = 'var(--bg-hover)';
          btn.style.color = 'var(--text-primary)';
        };
        btn.onmouseleave = () => {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-secondary)';
        };
        
        extContainer.appendChild(btn);
        return btnId;
      },
      
      removeButton: (btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.remove();
      },
      
      setBadge: (btnId, text) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        let badge = btn.querySelector('.ext-badge');
        if (text) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ext-badge';
            badge.style.cssText = `
              position: absolute; top: 2px; right: 2px;
              background: var(--danger); color: white;
              font-size: 9px; min-width: 12px; height: 12px;
              border-radius: 6px; display: flex; align-items: center;
              justify-content: center; font-weight: 700;
            `;
            btn.style.position = 'relative';
            btn.appendChild(badge);
          }
          badge.textContent = text;
          badge.style.display = 'flex';
        } else if (badge) {
          badge.style.display = 'none';
        }
      },
      addTab: (url) => { if (typeof createNewTab === 'function') createNewTab(url); },
      executeInActiveTab: (code) => {
        if (typeof getActiveTab === 'function') {
          const t = getActiveTab();
          if (t && t.webview) t.webview.executeJavaScript(code).catch(e => {});
        }
      },
      executeInAllTabs: (code) => {
        document.querySelectorAll('webview').forEach(wv => wv.executeJavaScript(code).catch(e => {}));
      },
      setValue: (key, val) => {
        if (!window.visibExt.storage[extId]) window.visibExt.storage[extId] = {};
        window.visibExt.storage[extId][key] = val;
        saveStorage();
      },
      getValue: (key) => {
        return window.visibExt.storage[extId] ? window.visibExt.storage[extId][key] : null;
      },
      toast: (msg) => { if (typeof toast === 'function') toast(msg); },
      prompt: (msg, callback) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.zIndex = '999999'; overlay.style.display = 'flex';
        overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
        
        const box = document.createElement('div');
        box.style.background = 'var(--bg-secondary, #1e1e20)';
        box.style.padding = '20px'; box.style.borderRadius = '8px';
        box.style.border = '1px solid var(--border-bright, #4c4c52)';
        box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.gap = '10px'; box.style.minWidth = '300px';
        const label = document.createElement('div');
        label.textContent = msg; label.style.color = '#fff'; label.style.fontSize = '14px';
        const input = document.createElement('input');
        input.type = 'text'; input.style.padding = '8px'; input.style.background = 'rgba(255,255,255,0.05)';
        input.style.border = '1px solid #444'; input.style.color = '#fff'; input.style.outline = 'none';
        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex'; btnWrap.style.gap = '8px'; btnWrap.style.justifyContent = 'flex-end';
        const btnOk = document.createElement('button');
        btnOk.textContent = 'OK'; btnOk.style.padding = '6px 12px'; btnOk.style.background = '#4caf50';
        btnOk.style.border = 'none'; btnOk.style.color = '#fff'; btnOk.style.borderRadius = '4px'; btnOk.style.cursor = 'pointer';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = window.t ? window.t('btn-cancel', 'Cancel') : 'Cancel'; btnCancel.style.padding = '6px 12px'; btnCancel.style.background = 'transparent';
        btnCancel.style.border = '1px solid #666'; btnCancel.style.color = '#ccc'; btnCancel.style.borderRadius = '4px'; btnCancel.style.cursor = 'pointer';
        
        const close = (val) => { document.body.removeChild(overlay); callback(val); };
        btnOk.onclick = () => close(input.value);
        btnCancel.onclick = () => close(null);
        input.onkeydown = (e) => { if(e.key==='Enter')close(input.value); if(e.key==='Escape')close(null); };
        btnWrap.appendChild(btnCancel); btnWrap.appendChild(btnOk);
        box.appendChild(label); box.appendChild(input); box.appendChild(btnWrap);
        overlay.appendChild(box); document.body.appendChild(overlay);
        input.focus();
      },
      showPopup: (html, callback) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          z-index: 1000000; display: flex; align-items: center; justify-content: center;
        `;
        overlay.onclick = () => { if (document.body.contains(overlay)) document.body.removeChild(overlay); };
        
        const box = document.createElement('div');
        box.style.cssText = `
          background: var(--bg-secondary, #1e1e20); padding: 20px; border-radius: 12px;
          border: 1px solid var(--border, #333); min-width: 350px; max-width: 500px;
          max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        `;
        box.onclick = (e) => e.stopPropagation();
        box.innerHTML = html;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
          position: absolute; top: 10px; right: 10px; width: 24px; height: 24px;
          background: transparent; border: none; color: var(--text-muted);
          cursor: pointer; font-size: 14px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = 'var(--bg-hover)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = () => { if (document.body.contains(overlay)) document.body.removeChild(overlay); };
        box.style.position = 'relative';
        box.appendChild(closeBtn);
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        if (callback) callback(box);
        return overlay;
      },
      
      showSidePanel: (title, html, width = 320) => {
        let panel = document.getElementById('ext-side-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'ext-side-panel';
          panel.style.cssText = `
            position: fixed; top: 0; right: 0; width: ${width}px; height: 100vh;
            background: var(--bg-secondary); border-left: 1px solid var(--border);
            z-index: 9999; display: flex; flex-direction: column;
            transform: translateX(100%); transition: transform 0.3s ease;
          `;
          document.body.appendChild(panel);
        }
        
        panel.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border);">
            <span style="font-weight: 600; font-size: 14px;">${title}</span>
            <button id="ext-panel-close" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">✕</button>
          </div>
          <div style="flex: 1; overflow-y: auto; padding: 16px;">${html}</div>
        `;
        
        panel.style.width = width + 'px';
        panel.querySelector('#ext-panel-close').onclick = () => {
          panel.style.transform = 'translateX(100%)';
        };
        
        requestAnimationFrame(() => {
          panel.style.transform = 'translateX(0)';
        });
        
        return panel;
      },
      
      closeSidePanel: () => {
        const panel = document.getElementById('ext-side-panel');
        if (panel) panel.style.transform = 'translateX(100%)';
      },
      
      registerShortcut: (keyCombo, callback) => {
        const handler = (e) => {
          const keys = keyCombo.toLowerCase().split('+');
          const hasCtrl = keys.includes('ctrl') || keys.includes('cmd');
          const hasAlt = keys.includes('alt');
          const hasShift = keys.includes('shift');
          const mainKey = keys.find(k => !['ctrl', 'cmd', 'alt', 'shift'].includes(k));
          
          if (e.ctrlKey === hasCtrl && e.altKey === hasAlt && e.shiftKey === hasShift && 
              e.key.toLowerCase() === mainKey) {
            e.preventDefault();
            callback(e);
          }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
      },
      
      clipboard: {
        readText: () => navigator.clipboard.readText(),
        writeText: (text) => navigator.clipboard.writeText(text)
      },

      registerMainAction: (callback) => {
        const ext = window.visibExt.active.find(e => e.id === extId);
        if (ext) ext._mainAction = callback;
      },

      addMenu: (items) => {
        const ext = window.visibExt.active.find(e => e.id === extId);
        if (ext) ext._menuItems = items;
        ext._mainAction = () => _showExtMenu(extId, items);
      },

      getCurrentURL: () => {
        const t = tabs.find(x => x.id === activeTabId);
        return t ? (t.webview ? t.webview.getURL() : t.url) : '';
      },
      getCurrentTitle: () => {
        const t = tabs.find(x => x.id === activeTabId);
        return t ? (t.webview ? t.webview.getTitle() : t.title) : '';
      },
      
      fetch: async (url, options = {}) => {
        try {
          const { net } = require('electron');
          const response = await net.fetch(url, options);
          return response;
        } catch (e) {
          return fetch(url, options);
        }
      },
      tabs: {
        create: (url) => { if (typeof createNewTab === 'function') return createNewTab(url); },
        close: (id) => { if (typeof closeTab === 'function') closeTab(id); },
        switch: (id) => { if (typeof switchTab === 'function') switchTab(id); },
        getAll: () => tabs,
        getActiveId: () => activeTabId,
        duplicate: (id) => { if (typeof duplicateTab === 'function') duplicateTab(id); },
        getActive: () => tabs.find(t => t.id === activeTabId),
        executeInAll: (code) => { document.querySelectorAll('webview').forEach(wv => wv.executeJavaScript(code).catch(e => {})); }
      },
      window: {
        minimize: () => ipcRenderer.send('minimize-window'),
        maximize: () => ipcRenderer.send('maximize-window'),
        close: () => ipcRenderer.send('close-window'),
        setFullScreen: (val) => ipcRenderer.send('set-fullscreen', val),
        isMaximized: (callback) => {
          ipcRenderer.once('maximized-status', (e, status) => callback(status));
          ipcRenderer.send('is-maximized');
        }
      },
      navigation: {
        back: () => { const t = tabs.find(x => x.id === activeTabId); if (t) try { t.webview.goBack(); } catch(e){} },
        forward: () => { const t = tabs.find(x => x.id === activeTabId); if (t) try { t.webview.goForward(); } catch(e){} },
        reload: () => { const t = tabs.find(x => x.id === activeTabId); if (t) try { t.webview.reload(); } catch(e){} },
        stop: () => { const t = tabs.find(x => x.id === activeTabId); if (t) try { t.webview.stop(); } catch(e){} },
        goTo: (url) => { if (typeof navigate === 'function') navigate(url); }
      },
      cookies: {
        get: async (filter) => await ipcRenderer.invoke('get-cookies', filter),
        set: async (details) => await ipcRenderer.invoke('set-cookie', details),
        remove: async (url, name) => await ipcRenderer.invoke('remove-cookie', { url, name }),
        clearAll: () => ipcRenderer.send('clear-cookies')
      },
      page: {
        executeJS: (code) => {
          const t = tabs.find(x => x.id === activeTabId);
          if (t && t.webview) return t.webview.executeJavaScript(code);
        },
        insertCSS: (css) => {
          const t = tabs.find(x => x.id === activeTabId);
          if (t && t.webview) return t.webview.insertCSS(css);
        },
        capturePage: (callback) => {
          const t = tabs.find(x => x.id === activeTabId);
          if (t && t.webview) t.webview.capturePage().then(callback);
        }
      },
      devtools: {
        open: () => { const t = tabs.find(x => x.id === activeTabId); if (t) t.webview.openDevTools(); },
        close: () => { const t = tabs.find(x => x.id === activeTabId); if (t) t.webview.closeDevTools(); }
      },
      app: {
        getVersion: () => ipcRenderer.sendSync('get-app-version'),
        getPath: (name) => ipcRenderer.sendSync('get-path', name),
        relaunch: () => ipcRenderer.send('relaunch-app')
      },
      notifications: {
        show: (msg) => { if (typeof toast === 'function') toast(msg); },
        banner: (options) => { if (typeof showBanner === 'function') showBanner(options); },
        error: (msg, title) => { if (typeof showError === 'function') showError(msg, title); },
        warning: (msg, title) => { if (typeof showWarning === 'function') showWarning(msg, title); },
        success: (msg, title) => { if (typeof showSuccess === 'function') showSuccess(msg, title); },
        info: (msg, title) => { if (typeof showInfo === 'function') showInfo(msg, title); }
      },
      themes: {
        register: (theme) => {
          if (!theme || !theme.id || !theme.name) return false;
          if (!window.visibExt.themes) window.visibExt.themes = new Map();
          theme.extensionId = extId;
          theme.extensionName = window.visibExt.active.find(e => e.id === extId)?.name || extId;
          window.visibExt.themes.set(theme.id, theme);
          if (typeof window.refreshExtThemesInSettings === 'function') window.refreshExtThemesInSettings();
          return true;
        },
        apply: (themeId) => {
          const theme = window.visibExt.themes?.get(themeId);
          if (!theme) return false;
          let styleEl = document.getElementById('visib-ext-active-theme');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'visib-ext-active-theme';
            document.head.appendChild(styleEl);
          }
          if (theme.cssVars) {
            const varsStr = Object.entries(theme.cssVars).map(([k, v]) => `${k.startsWith('--') ? k : '--' + k}: ${v};`).join(' ');
            styleEl.textContent = `:root, body { ${varsStr} }`;
          } else if (theme.css) {
            styleEl.textContent = theme.css;
          }
          return true;
        },
        reset: () => {
          const styleEl = document.getElementById('visib-ext-active-theme');
          if (styleEl) styleEl.remove();
        }
      },
      settings: {
        get: () => settings,
        set: (newSettings) => {
          Object.assign(settings, newSettings);
          ipcRenderer.send('save-settings', settings);
          if (typeof updateVisibilityTheme === 'function') updateVisibilityTheme();
        },
        setDarkMode: (val) => {
          settings.darkMode = val;
          ipcRenderer.send('save-settings', settings);
          if (typeof updateVisibilityTheme === 'function') updateVisibilityTheme();
        },
        addControl: (tabName, control) => {
          if (!window.visibExt.settingsControls) window.visibExt.settingsControls = [];
          const extName = window.visibExt.active.find(e => e.id === extId)?.name || extId;
          const ctrlObj = { ...control, tab: tabName, extId, extName };
          window.visibExt.settingsControls.push(ctrlObj);
          if (typeof window.renderExtSettingsControls === 'function') window.renderExtSettingsControls();
          return ctrlObj;
        }
      },
      ui: {
        injectCSS: (css) => {
          const id = `ext-css-${extId}-${Date.now()}`;
          const style = document.createElement('style');
          style.id = id;
          style.textContent = css;
          document.head.appendChild(style);
          return () => style.remove();
        },
        addNTPWidget: (widgetHtml) => {
          const ntp = document.getElementById('new-tab-page');
          if (!ntp) return null;
          const widget = document.createElement('div');
          widget.className = 'ntp-ext-widget';
          widget.dataset.extId = extId;
          widget.innerHTML = widgetHtml;
          ntp.insertBefore(widget, ntp.querySelector('.ntp-footer'));
          return widget;
        },
        addContextMenuItem: (item) => {
          if (!window.visibExt.contextMenuItems) window.visibExt.contextMenuItems = [];
          window.visibExt.contextMenuItems.push({ ...item, extId });
        }
      },
      vpn: {
        connect: async (index) => {
          return await ipcRenderer.invoke('vpn-connect', index);
        },
        disconnect: async () => {
          return await ipcRenderer.invoke('vpn-disconnect');
        },
        getStatus: async () => {
          return await ipcRenderer.invoke('get-vpn-status');
        },
        addLink: async (link) => {
          return await ipcRenderer.invoke('vpn-add-link', link);
        },
        fetchSub: async (url) => {
          return await ipcRenderer.invoke('vpn-fetch-sub', url);
        }
      }
    };
  }

  function _showExtMenu(extId, items) {
    const ext = window.visibExt.active.find(e => e.id === extId);
    if (!ext || !items || !items.length) return;
    const existing = document.getElementById('ext-ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'ext-ctx-menu';
    menu.style.cssText = `
      position: fixed; z-index: 999999;
      background: var(--bg-secondary, #1e1e20);
      border: 1px solid var(--border-bright, #3a3a40);
      border-radius: 10px; padding: 6px;
      min-width: 200px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      backdrop-filter: blur(12px);
    `;

    const drop = document.getElementById('extensions-dropdown');
    const rect = drop ? drop.getBoundingClientRect() : { left: window.innerWidth - 330, top: 50 };
    menu.style.right = (window.innerWidth - rect.left + 8) + 'px';
    menu.style.top = '60px';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 6px 10px 8px; font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px;';
    header.textContent = (ext.manifest && ext.manifest.name) ? ext.manifest.name : extId;
    menu.appendChild(header);

    items.forEach(item => {
      if (item === 'separator') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: rgba(255,255,255,0.06); margin: 4px 6px;';
        menu.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 8px 12px; background: transparent;
        border: none; color: var(--text-primary, #fff); text-align: left;
        cursor: pointer; font-size: 13px; border-radius: 7px; transition: background 0.15s;
      `;
      if (item.icon) {
        const ic = document.createElement('span');
        ic.style.cssText = 'font-size: 15px; width: 20px; text-align: center; flex-shrink: 0;';
        ic.textContent = item.icon;
        btn.appendChild(ic);
      }
      const label = document.createElement('span');
      label.textContent = item.label || '';
      if (item.danger) label.style.color = 'var(--danger, #ef4444)';
      btn.appendChild(label);
      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.style.cssText = 'margin-left: auto; font-size: 11px; color: var(--text-muted); opacity: 0.6;';
        sc.textContent = item.shortcut;
        btn.appendChild(sc);
      }
      btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.07)';
      btn.onmouseleave = () => btn.style.background = 'transparent';
      btn.onclick = () => {
        menu.remove();
        if (typeof item.action === 'function') {
          try { item.action(); } catch(e) { console.error('Ext menu action error:', e); }
        }
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', function dismiss(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', dismiss); }
      });
    }, 50);
  }

  function renderExtensionsDropdown() {
    const list = document.getElementById('ext-list');
    if (!list) return;
    list.innerHTML = '';
    
    const t = window.t || ((k, f) => f || k);
    
    if (window.visibExt.active.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:50px 20px;">
        <div class="empty-state-icon" style="opacity:0.2;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        </div>
        <div class="empty-state-text">${t('ext-empty', 'Нет расширений')}</div>
        <div style="font-size:11px; color:var(--text-muted); opacity:0.5; margin-top:4px;">${t('ext-empty-hint', 'Установите .visibility файл')}</div>
      </div>`;
      return;
    }
    
    window.visibExt.active.forEach(ext => {
      const item = document.createElement('div');
      item.className = 'ext-item';
      const hasAction = typeof ext._mainAction === 'function';
      if (hasAction) {
        item.style.cursor = 'pointer';
        item.title = t('ext-click-hint', 'Нажмите чтобы открыть');
        item.onclick = (e) => {
          if (e.target.closest('.ext-del')) return;
          try { ext._mainAction(e); } catch(err) { console.error('Ext action error:', err); }
        };
        item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.07)';
        item.onmouseleave = () => item.style.background = '';
      }

      const iconWrap = document.createElement('div');
      iconWrap.className = 'ext-icon-wrap';
      const iconSrc = ext.manifest && (ext.manifest.icon || ext.manifest.icon_url);
      if (iconSrc) {
        if (iconSrc.length <= 4 || iconSrc.startsWith('data:') === false && !iconSrc.startsWith('http') && !iconSrc.startsWith('/') && !iconSrc.startsWith('.')) {
          iconWrap.style.fontSize = '20px';
          iconWrap.textContent = iconSrc;
        } else {
          const img = document.createElement('img');
          img.src = iconSrc;
          img.style.cssText = 'width: 22px; height: 22px; border-radius: 4px; object-fit: contain;';
          img.onerror = () => { iconWrap.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M12 18h.01"/><path d="M12 14h.01"/><path d="M12 10h.01"/></svg>'; iconWrap.style.fontSize = ''; };
          iconWrap.appendChild(img);
        }
      } else {
        iconWrap.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
      }
      item.appendChild(iconWrap);

      const info = document.createElement('div');
      info.className = 'ext-info';
      
      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      const name = document.createElement('div');
      name.className = 'ext-name';
      name.textContent = (ext.manifest && ext.manifest.name) ? ext.manifest.name : ext.id;
      nameRow.appendChild(name);
      
      if (ext.manifest && ext.manifest.is_official) {
        const badge = document.createElement('span');
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg>';
        badge.title = t('ext-official', 'Официальное расширение');
        badge.style.cssText = 'background: #2787F5; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
        nameRow.appendChild(badge);
      } else if (ext.manifest && ext.manifest.is_verified) {
        const badge = document.createElement('span');
        badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20,6 9,17 4,12"/></svg>';
        badge.title = t('ext-verified', 'Проверенное расширение');
        badge.style.cssText = 'background: #4CAF50; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
        nameRow.appendChild(badge);
      }

      if (hasAction) {
        const arrow = document.createElement('span');
        arrow.style.cssText = 'margin-left: auto; font-size: 11px; color: var(--text-muted); opacity: 0.5;';
        arrow.textContent = ext._menuItems ? '☰' : '▷';
        nameRow.appendChild(arrow);
      }
      
      const desc = document.createElement('div');
      desc.className = 'ext-desc';
      desc.textContent = (ext.manifest && ext.manifest.description) ? ext.manifest.description : t('ext-default-desc', 'Расширение интерфейса');
      
      info.appendChild(nameRow);
      info.appendChild(desc);
      
      const del = document.createElement('button');
      del.className = 'ext-del';
      del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      del.title = t('ext-delete', 'Удалить');
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirm(t('ext-delete-confirm', 'Удалить расширение') + ' ' + name.textContent + '?')) {
          try { fs.unlinkSync(path.join(extDir, ext.id)); } catch(e) {}
          window.visibExt.active = window.visibExt.active.filter(x => x.id !== ext.id);
          document.querySelectorAll(`[id^="ext-btn-${ext.id}"]`).forEach(b => b.remove());
          const s = document.getElementById('ext-style-' + ext.id.replace(/\W/g, ''));
          if (s) s.remove();
          const h = document.getElementById('ext-html-' + ext.id.replace(/\W/g, ''));
          if (h) h.remove();
          renderExtensionsDropdown();
          if (typeof toast === 'function') toast(t('ext-deleted', 'Расширение удалено'));
        }
      };
      
      item.appendChild(info);
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function applyExtension(extContent, id) {
    if (extContent.manifest) {
      window.visibExt.active.push({ id, ...extContent });
      
      if (extContent.ui_style) {
        try {
          const styleId = 'ext-style-' + id.replace(/\W/g, '');
          let styleEl = document.getElementById(styleId);
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = extContent.ui_style;
        } catch(e) { console.error('Ошибка в ui_style:', e); }
      }

      if (extContent.ui_html) {
        try {
          const htmlId = 'ext-html-' + id.replace(/\W/g, '');
          let htmlEl = document.getElementById(htmlId);
          if (!htmlEl) {
            htmlEl = document.createElement('div');
            htmlEl.id = htmlId;
            htmlEl.className = 'ext-html-container';
            document.body.appendChild(htmlEl);
          }
          htmlEl.innerHTML = extContent.ui_html;
        } catch(e) { console.error('Ошибка в ui_html:', e); }
      }

      if (extContent.ui_script) {
        try {
          const api = createExtApi(id);
          const fn = new Function('visib', extContent.ui_script);
          fn(api);
        } catch(e) { 
          console.error(`Ошибка UI скрипта в расширении ${id}:`, e); 
        }
      }
    }
  }

  function loadAllExtensions() {
    try {
      window.visibExt.active = []; // Clear array to prevent duplicates on manual installation
      document.querySelectorAll('.ext-added-btn').forEach(b => b.remove()); // Clear UI elements
      const t = document.getElementById('ext-tray'); if (t) t.remove();
      
      document.querySelectorAll('[id^="ext-style-"]').forEach(el => el.remove());
      document.querySelectorAll('.ext-html-container').forEach(el => el.remove());
      
      const files = fs.readdirSync(extDir);
      files.forEach(f => {
        if (f.endsWith('.visibility')) {
          try {
            const txt = fs.readFileSync(path.join(extDir, f), 'utf8');
            let ext;
            if (txt.startsWith('VISIB_ENC:')) {
               const b64 = txt.substring(10).split('').reverse().join('');
               const decoded = decodeURIComponent(atob(b64));
               ext = JSON.parse(decoded);
            } else {
               ext = JSON.parse(txt);
            }
            applyExtension(ext, f);
          } catch(e) { console.error('Ошибка загрузки расширения:', f, e); }
        }
      });
      console.log(`Загружено ${window.visibExt.active.length} расширений VISIB.`);
      renderExtensionsDropdown();
    } catch(e) {
      console.error('Ошибка чтения папки расширений:', e);
    }
  }

  function initWebview(n) {
    n.addEventListener('dom-ready', () => {
      try {
        const currentUrl = n.getURL();
        if (!currentUrl || currentUrl === 'about:blank') return;
      } catch (e) { return; }

      window.visibExt.active.forEach(ext => {
        if (ext.content_script) {
          n.executeJavaScript(ext.content_script).catch(e => {});
        }
      });

      const storage = window.visibExt.storage;
      if (storage) {
        Object.keys(storage).forEach(extId => {
          if (extId.includes('Dark_Reader') && storage[extId].enabled) {
             const css = "html { filter: invert(90%) hue-rotate(180deg) !important; background: #fff !important; } img, video, iframe, canvas, [style*='background-image'] { filter: invert(100%) hue-rotate(180deg) !important; }";
             n.insertCSS(css).catch(e=>{});
          }
        });
      }
    });
  }

  window.initWebviewExtensions = initWebview;

  window.installVisibilityExtension = async () => {
    const t = window.t || ((k, f) => f || k);
    const res = await ipcRenderer.invoke('show-ext-open-dialog');
    if (!res.canceled && res.filePaths.length > 0) {
      const p = res.filePaths[0];
      try {
        const content = fs.readFileSync(p, 'utf8');
        let extObj;
        if (content.startsWith('VISIB_ENC:')) {
           const b64 = content.substring(10).split('').reverse().join('');
           const decoded = decodeURIComponent(atob(b64));
           extObj = JSON.parse(decoded);
        } else {
           extObj = JSON.parse(content); // JSON validation
        }
        const fname = path.basename(p);
        fs.writeFileSync(path.join(extDir, fname), content, 'utf8');
        if (typeof toast === 'function') toast(t('ext-installed', 'Extension installed! Restart browser').replace('Extension', fname.split('.')[0]));
        loadAllExtensions(); // Try to load on the fly
      } catch(e) {
        if (typeof toast === 'function') toast(t('ext-install-error', 'Extension file error (Invalid format)'));
      }
    }
  };

  setTimeout(() => {
    const extBtn = document.getElementById('btn-extensions');
    const extDrop = document.getElementById('extensions-dropdown');
    const installBtn = document.getElementById('btn-ext-install');
    
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        extDrop.classList.remove('show');
        window.installVisibilityExtension();
      });
    }

    const closeExtBtn = document.getElementById('btn-close-extensions');

    if (extBtn && extDrop) {
      extBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dlPanel = document.getElementById('downloads-panel');
        if (dlPanel) dlPanel.classList.remove('open');
        extDrop.classList.toggle('show');
        renderExtensionsDropdown();
      });

      document.addEventListener('click', (e) => {
        if (extDrop.classList.contains('show') && !extDrop.contains(e.target) && !extBtn.contains(e.target)) {
          extDrop.classList.remove('show');
        }
      });

      if (closeExtBtn) {
        closeExtBtn.addEventListener('click', () => {
          extDrop.classList.remove('show');
        });
      }
    }
  }, 500);

  window.renderExtSettingsControls = function() {
    const controls = window.visibExt.settingsControls || [];
    if (!controls.length) return;

    controls.forEach(ctrl => {
      const panelId = ctrl.tab ? (ctrl.tab.startsWith('stab-') ? ctrl.tab : 'stab-' + ctrl.tab) : 'stab-main';
      const panel = document.getElementById(panelId);
      if (!panel) return;

      let extGroup = panel.querySelector(`.setting-group[data-ext-group="${ctrl.extId}"]`);
      if (!extGroup) {
        extGroup = document.createElement('div');
        extGroup.className = 'setting-group';
        extGroup.dataset.extGroup = ctrl.extId;
        
        const title = document.createElement('div');
        title.className = 'setting-group-title';
        title.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;';
        title.innerHTML = `
          <span>${ctrl.groupTitle || 'Настройки расширения'}</span>
          <span style="font-size: 10px; background: rgba(0,122,255,0.15); color: #3897ff; padding: 2px 8px; border-radius: 10px; font-weight: 600;">🧩 Настройка создана расширением ${ctrl.extName}</span>
        `;
        extGroup.appendChild(title);
        
        const card = document.createElement('div');
        card.className = 'setting-group-card';
        card.style.border = '1px solid rgba(0, 122, 255, 0.3)';
        extGroup.appendChild(card);

        panel.appendChild(extGroup);
      }

      if (extGroup.querySelector(`[data-ctrl-id="${ctrl.id || ctrl.label}"]`)) return;

      const row = document.createElement('div');
      row.className = 'setting-row';
      row.dataset.ctrlId = ctrl.id || ctrl.label;
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.05));';

      const labelWrap = document.createElement('div');
      labelWrap.innerHTML = `
        <div style="font-size: 13px; font-weight: 600;">${ctrl.label}</div>
        ${ctrl.desc ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${ctrl.desc}</div>` : ''}
      `;
      row.appendChild(labelWrap);

      const controlWrap = document.createElement('div');
      if (ctrl.type === 'toggle') {
        const toggle = document.createElement('label');
        toggle.className = 'toggle';
        toggle.innerHTML = `<input type="checkbox" ${ctrl.value ? 'checked' : ''}><span class="toggle-slider"></span>`;
        toggle.querySelector('input').onchange = (e) => ctrl.onChange && ctrl.onChange(e.target.checked);
        controlWrap.appendChild(toggle);
      } else if (ctrl.type === 'button') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.padding = '6px 14px';
        btn.style.fontSize = '12px';
        btn.textContent = ctrl.buttonText || 'Выполнить';
        btn.onclick = () => ctrl.onClick && ctrl.onClick();
        controlWrap.appendChild(btn);
      } else if (ctrl.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'setting-select';
        (ctrl.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = typeof opt === 'object' ? opt.value : opt;
          o.textContent = typeof opt === 'object' ? opt.label : opt;
          if (o.value === ctrl.value) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = (e) => ctrl.onChange && ctrl.onChange(e.target.value);
        controlWrap.appendChild(sel);
      }
      row.appendChild(controlWrap);
      const cardContainer = extGroup.querySelector('.setting-group-card') || extGroup;
      cardContainer.appendChild(row);
    });
  };

  window.refreshExtThemesInSettings = function() {
    const themes = window.visibExt.themes;
    if (!themes || !themes.size) return;

    const appearancePanel = document.getElementById('stab-appearance');
    if (!appearancePanel) return;

    let themeGroup = appearancePanel.querySelector('#setting-group-ext-themes');
    if (!themeGroup) {
      themeGroup = document.createElement('div');
      themeGroup.id = 'setting-group-ext-themes';
      themeGroup.className = 'setting-group setting-group-card';
      themeGroup.style.marginBottom = '16px';
      themeGroup.innerHTML = `<div class="setting-group-title" style="padding: 10px 14px 4px; font-size: 11px; text-transform: uppercase; color: var(--text-muted);">🎨 Темы от расширений</div>`;
      appearancePanel.appendChild(themeGroup);
    }

    themes.forEach(theme => {
      if (themeGroup.querySelector(`[data-theme-id="${theme.id}"]`)) return;
      const row = document.createElement('div');
      row.className = 'setting-row';
      row.dataset.themeId = theme.id;
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.05));';
      row.innerHTML = `
        <div>
          <div style="font-size: 13px; font-weight: 600;">${theme.name}</div>
          <div style="font-size: 11px; color: #3897ff; margin-top: 2px;">🧩 Автор: ${theme.extensionName}</div>
        </div>
        <button class="btn btn-secondary btn-apply-theme" style="padding: 5px 12px; font-size: 12px;">Применить</button>
      `;
      row.querySelector('.btn-apply-theme').onclick = () => {
        window.visibExt.api(theme.extensionId).themes.apply(theme.id);
        if (typeof toast === 'function') toast(`Применена тема "${theme.name}"`);
      };
      themeGroup.appendChild(row);
    });
  };

  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    const observer = new MutationObserver(() => {
      if (settingsModal.classList.contains('open')) {
        setTimeout(() => {
          if (typeof window.renderExtSettingsControls === 'function') window.renderExtSettingsControls();
          if (typeof window.refreshExtThemesInSettings === 'function') window.refreshExtThemesInSettings();
        }, 100);
      }
    });
    observer.observe(settingsModal, { attributes: true, attributeFilter: ['class'] });
  }

  loadAllExtensions();

})();
