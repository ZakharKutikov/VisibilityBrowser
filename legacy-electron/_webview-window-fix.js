// _webview-window-fix.js
"use strict";

window.hookWebviewWindowFix = (wv) => {
  if (!wv || wv._hookedForNewWindow) return;
  wv._hookedForNewWindow = true;

  wv.addEventListener('new-window', (e) => {
    e.preventDefault();
    const targetUrl = e.url;
    if (!targetUrl || targetUrl === 'about:blank') return;
    if (typeof window.openIncomingUrl === 'function') {
      window.openIncomingUrl(targetUrl);
    } else if (typeof window.createNewTab === 'function') {
      window.createNewTab(targetUrl);
    }
  });
};
