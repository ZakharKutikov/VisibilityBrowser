const { ipcRenderer } = require('electron');

const historyList = document.getElementById('history-list');
const bookmarksList = document.getElementById('bookmarks-list');
const historySearch = document.getElementById('history-search');

const uiSvg = {
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  clock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  close: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}

document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  });
});

let historyFullCache = [];
let historyRenderedCount = 0;
const HISTORY_PAGE_SIZE = 40;

ipcRenderer.on('history-data', (e, history) => {
  historyFullCache = (history || []).filter(item => item.url && !item.url.startsWith('data:'));
  renderHistoryInitial();
});

function renderHistoryItemHtml(item) {
  const su = escAttr(item.url);
  const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};
  return `<div class="history-item">
    <div class="hi-icon">${uiSvg.globe}</div>
    <div class="hi-content" onclick="ipcRenderer.send('open-url-in-main', '${su}')">
      <div class="hi-title">${escHtml(item.title || item.url)}</div>
      <div class="hi-url">${escHtml(item.url)}</div>
      <div class="hi-time" style="display:flex; align-items:center; gap:6px;">${uiSvg.clock} ${escHtml(item.displayTime || '')}</div>
    </div>
    <button class="hi-delete" onclick="event.stopPropagation();ipcRenderer.send('delete-history-item', '${su}')" title="${t['btn-close'] || 'Удалить'}">${uiSvg.trash}</button>
  </div>`;
}

function renderHistoryInitial() {
  historyRenderedCount = 0;
  const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : { 'nothing-found': 'Ничего не найдено', 'empty-history': 'История пуста' };
  if (!historyFullCache.length) {
    historyList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${uiSvg.book}</div><div class="empty-state-text">${historySearch.value ? (t['nothing-found'] || 'Ничего не найдено') : (t['empty-history'] || 'История пуста')}</div></div>`;
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

historyList?.addEventListener('scroll', () => {
  if (historyList.scrollTop + historyList.clientHeight >= historyList.scrollHeight - 120) {
    appendHistoryChunk();
  }
});

window.addEventListener('focus', () => {
  ipcRenderer.send('get-history');
});

let histSearchTimer;
historySearch.addEventListener('input', e => {
  clearTimeout(histSearchTimer);
  histSearchTimer = setTimeout(() => {
    const q = e.target.value.trim();
    if (q) ipcRenderer.send('search-history', q);
    else ipcRenderer.send('get-history');
  }, 250);
});


document.getElementById('btn-clear-history').addEventListener('click', () => {
  const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : { 'del-hist-confirm': 'Очистить всю историю?' };
  if (confirm(t['del-hist-confirm'] || 'Очистить всю историю?')) {
    ipcRenderer.send('clear-history');
  }
});

ipcRenderer.on('bookmarks-data', (e, bms) => renderBookmarks(bms));

function renderBookmarks(bms) {
  const t = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : { 'empty-bookmarks': 'Нет закладок' };
  if (!bms.length) {
    bookmarksList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${uiSvg.star}</div><div class="empty-state-text">${t['empty-bookmarks'] || 'Нет закладок'}</div></div>`;
    return;
  }
  bookmarksList.innerHTML = bms.map(bm => {
    const safeSrc = escAttr(bm.url);
    const favicon = bm.favicon
      ? `<img src="${escAttr(bm.favicon)}" style="width:14px;height:14px;object-fit:contain" onerror="this.parentElement.innerHTML='${uiSvg.star.replace(/"/g, '&quot;')}'">`
      : uiSvg.star;
    return `<div class="bm-item" onclick="ipcRenderer.send('open-url-in-main', '${safeSrc}')">
      <div style="font-size:14px;flex-shrink:0">${favicon}</div>
      <div style="flex:1;min-width:0;">
        <div class="bm-title">${escHtml(bm.title || bm.url)}</div>
        <div class="bm-url">${escHtml(bm.url)}</div>
      </div>
      <button class="bm-remove" onclick="event.stopPropagation();ipcRenderer.send('remove-bookmark', '${safeSrc}')" title="${(typeof translations !== 'undefined' && translations[currentLang] ? translations[currentLang]['btn-close'] : 'Удалить')}">${uiSvg.close}</button>
    </div>`;
  }).join('');
}

ipcRenderer.send('get-history');
ipcRenderer.send('get-bookmarks');
