'use strict';

(function () {

const findBar    = document.getElementById('find-bar');
const findInput  = document.getElementById('find-input');
const findCount  = document.getElementById('find-count');
const findPrev   = document.getElementById('find-btn-prev');
const findNext   = document.getElementById('find-btn-next');
const findClose  = document.getElementById('find-btn-close');

let findIsOpen = false;

function openFind() {
  if (!findBar) return;
  findBar.classList.add('show');
  findIsOpen = true;
  findInput.focus();
  findInput.select();
  if (findInput.value) doFind(findInput.value);
}
window.openFind  = openFind;
window.closeFind = closeFind;

function closeFind() {
  if (!findBar) return;
  findBar.classList.remove('show');
  findIsOpen = false;
  if (findCount) findCount.textContent = '';
  const tab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  if (tab && tab.webview) {
    try { tab.webview.stopFindInPage('clearSelection'); } catch (e) {}
  }
}

function doFind(query, forward = true) {
  if (!query) { if (findCount) findCount.textContent = ''; return; }
  const tab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  if (!tab || !tab.webview) return;
  try { tab.webview.findInPage(query, { forward }); } catch (e) {}
}

if (findInput) {
  findInput.addEventListener('input',   () => doFind(findInput.value));
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doFind(findInput.value, !e.shiftKey); }
    if (e.key === 'Escape') closeFind();
  });
}
if (findPrev)  findPrev.addEventListener('click',  () => doFind(findInput.value, false));
if (findNext)  findNext.addEventListener('click',  () => doFind(findInput.value, true));
if (findClose) findClose.addEventListener('click', closeFind);


window.hookFindInPage = (wv) => {
  wv.addEventListener('found-in-page', e => {
    if (!findIsOpen || !findCount) return;
    const { activeMatchOrdinal, matches } = e.result;
    findCount.textContent = matches > 0 ? `${activeMatchOrdinal} / ${matches}` : (window.t ? window.t('find-not-found', 'Not found') : 'Not found');
    findCount.style.color = matches > 0 ? 'var(--text-muted)' : 'var(--danger, #ef4444)';
  });
};

window.onTabSwitchedForFind = () => {
  if (findIsOpen && findInput.value) doFind(findInput.value);
};


const previewEl    = document.getElementById('tab-preview');
const previewImg   = document.getElementById('tab-preview-img');
const previewTitle = document.getElementById('tab-preview-title');
let   previewTimer  = null;
let   previewHoverId = null;

function showTabPreview(tab, tabEl) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (previewHoverId !== tab.id) return;

    if (typeof window.ensureTabThumbnail === 'function') window.ensureTabThumbnail(tab);

    const favEl = document.getElementById('tab-preview-favicon');
    const titleEl = document.getElementById('tab-preview-title');
    const domainEl = document.getElementById('tab-preview-domain');
    const imgEl = document.getElementById('tab-preview-img');
    const placeholderEl = document.getElementById('tab-preview-placeholder');

    if (titleEl) titleEl.textContent = tab.title || tab.url || 'Новая вкладка';
    if (domainEl) {
      try {
        domainEl.textContent = tab.url ? new URL(tab.url).hostname : '';
      } catch (e) {
        domainEl.textContent = '';
      }
    }

    if (favEl) {
      const tabFav = tab.element ? tab.element.querySelector('.tab-favicon') : null;
      favEl.innerHTML = tabFav ? tabFav.innerHTML : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
    }

    const dataUrl = tab._thumbnail;
    if (dataUrl) {
      if (imgEl) {
        imgEl.src = dataUrl;
        imgEl.style.display = 'block';
      }
      if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
      if (imgEl) {
        imgEl.removeAttribute('src');
        imgEl.style.display = 'none';
      }
      if (placeholderEl) placeholderEl.style.display = 'flex';
    }

    const rect = tabEl.getBoundingClientRect();
    if (previewEl) {
      const cardWidth = 240;
      const left = Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 12));
      previewEl.style.left = left + 'px';
      previewEl.style.top = (rect.bottom + 6) + 'px';
      previewEl.style.display = 'block';
      requestAnimationFrame(() => previewEl.classList.add('visible'));
    }
  }, 220);
}

function hideTabPreview() {
  clearTimeout(previewTimer);
  previewHoverId = null;
  if (previewEl) {
    previewEl.classList.remove('visible');
    setTimeout(() => {
      if (!previewEl.classList.contains('visible')) previewEl.style.display = 'none';
    }, 180);
  }
}

(function initTabPreview() {
  const tabsBar = document.getElementById('tabs-bar');
  if (!tabsBar) { setTimeout(initTabPreview, 200); return; }

  tabsBar.addEventListener('mouseover', (e) => {
    const tabEl = e.target.closest('.tab');
    if (!tabEl || tabEl.classList.contains('new-tab-btn')) return;

    const tabId = parseInt(tabEl.id.replace('tab-', ''));
    if (isNaN(tabId)) return;

    const tabsList = typeof tabs !== 'undefined' ? tabs : [];
    const activeId = typeof activeTabId !== 'undefined' ? activeTabId : null;
    const tab = tabsList.find(t => t.id === tabId);
    if (!tab || tab.id === activeId || tab.isNewTabPage || tab.sleeping) {
      hideTabPreview();
      return;
    }

    if (previewHoverId === tabId) return;

    previewHoverId = tabId;
    showTabPreview(tab, tabEl);
  });

  tabsBar.addEventListener('mouseout', (e) => {
    const tabEl = e.target.closest('.tab');
    const toEl = e.relatedTarget ? e.relatedTarget.closest('.tab') : null;
    
    if (tabEl && toEl === tabEl) return;
    
    if (!toEl) {
      hideTabPreview();
    }
  });

  tabsBar.addEventListener('scroll', hideTabPreview, { passive: true });
  document.addEventListener('click', hideTabPreview);
}());

window.hookTabPreview = () => {};


const SLEEP_MS = 15 * 60 * 1000; // 15 minutes

function checkSleepingTabs() {
  const tabsList = typeof tabs !== 'undefined' ? tabs : [];
  const activeId = typeof activeTabId !== 'undefined' ? activeTabId : null;
  const now = Date.now();

  tabsList.forEach(tab => {
    if (tab.id === activeId || tab.sleeping || tab.isNewTabPage || tab.incognito || tab.useBrowserView || tab.voiceMode) return;
    if (!tab.lastActiveTime) return;
    if (now - tab.lastActiveTime < SLEEP_MS) return;

    tab.sleeping = true;
    tab.element.title = (tab.title || '') + ' ' + (window.t ? window.t('tab-sleeping', '(sleeping)') : '(sleeping)');

    const fav = tab.element.querySelector('.tab-favicon');
    if (fav) {
      tab._savedFavicon = fav.innerHTML;
      fav.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b9aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }

    tab.element.style.opacity = '0.55';

    try {
      tab.webview.executeJavaScript(
        'document.querySelectorAll("video,audio").forEach(v=>{try{v.pause()}catch(e){}})'
      ).catch(() => {});
    } catch (e) {}
  });
}

window.wakeTab = (tab) => {
  if (!tab || !tab.sleeping) return;
  tab.sleeping = false;
  tab.lastActiveTime = Date.now();
  tab.element.style.opacity = '';
  tab.element.title = tab.title || '';
  const fav = tab.element.querySelector('.tab-favicon');
  if (fav && tab._savedFavicon != null) {
    fav.innerHTML = tab._savedFavicon;
    tab._savedFavicon = null;
  }
};

setInterval(checkSleepingTabs, 60_000);

window.ensureTabThumbnail = (tab) => {
  if (!tab?.webview || tab.isNewTabPage || tab._thumbnail || tab._thumbPending || tab.sleeping) return;
  tab._thumbPending = true;
  setTimeout(() => {
    tab._thumbPending = false;
    if (!tab.webview) return;
    try {
      tab.webview.capturePage()
        .then((img) => {
          if (img && !img.isEmpty()) {
            const resized = (typeof img.resize === 'function') ? img.resize({ width: 400 }) : img;
            tab._thumbnail = resized.toDataURL({ format: 'jpeg', quality: 0.70 });
            const imgEl = document.getElementById('tab-preview-img');
            const placeholderEl = document.getElementById('tab-preview-placeholder');
            if (previewHoverId === tab.id && imgEl && placeholderEl) {
              imgEl.src = tab._thumbnail;
              imgEl.style.display = 'block';
              placeholderEl.style.display = 'none';
            }
          }
        })
        .catch(() => {});
    } catch (e) {}
  }, 80);
};

})();
