'use strict';

(function () {
  const { ipcRenderer } = require('electron');

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function t(key, fallback) {
    if (typeof window.t === 'function') return window.t(key, fallback);
    return fallback || key;
  }

  const el = {
    overlay: () => document.getElementById('overlay-vpn'),
    hero: () => document.getElementById('vpn-hero'),
    dot: () => document.getElementById('vpn-dot-v3'),
    label: () => document.getElementById('vpn-stat-label'),
    sub: () => document.getElementById('vpn-info-v3'),
    tog: () => document.getElementById('btn-tog-v3'),
    bin: () => document.getElementById('vpn-no-binary'),
    lst: () => document.getElementById('vpn-list-v3'),
    url: () => document.getElementById('vpn-url-v3'),
    btnSub: () => document.getElementById('btn-sub-v3'),
    btnAdd: () => document.getElementById('btn-add-v3'),
    inpLnk: () => document.getElementById('vpn-link-input'),
    xrayTitle: () => document.getElementById('vpn-xray-title'),
    xrayDesc: () => document.getElementById('vpn-xray-desc'),
    xrayHint: () => document.getElementById('vpn-xray-hint'),
    dlBtn: () => document.getElementById('btn-download-xray'),
    routingSelect: () => document.getElementById('vpn-modal-routing-mode'),
    btnPing: () => document.getElementById('btn-vpn-ping'),
    btnTest: () => document.getElementById('btn-vpn-test'),
  };

  let vpnState = { connected: false, servers: [], current: null, hasBinary: true, routingMode: 'split-ru' };
  let vpnSelected = -1;
  let serverPings = {};

  function openVpn() {
    el.overlay()?.classList.add('show');
  }

  function closeVpn() {
    el.overlay()?.classList.remove('show');
  }

  window.openVpn = openVpn;
  window.closeVpn = closeVpn;

  function setToggleMode(mode) {
    const tog = el.tog();
    if (!tog) return;
    tog.classList.remove('connect', 'disconnect');
    tog.classList.add(mode === 'disconnect' ? 'disconnect' : 'connect');
  }

  function applyVpnLabels() {
    const title = document.getElementById('vpn-modal-title');
    if (title) title.textContent = t('btn-vpn', 'VPN');
    const heads = {
      'vpn-servers-head': 'vpn-servers-title',
      'vpn-sub-head': 'vpn-sub-title',
      'vpn-manual-head': 'vpn-manual-title'
    };
    Object.entries(heads).forEach(([id, key]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = t(key, node.textContent);
    });
    if (el.xrayTitle()) el.xrayTitle().textContent = t('vpn-xray-title', 'Xray-core не установлен');
    if (el.xrayDesc()) el.xrayDesc().textContent = t('vpn-xray-desc', 'Для загрузки ядра может потребоваться VPN — включите Happ, Hiddify, v2rayN или другой клиент.');
    if (el.xrayHint()) el.xrayHint().textContent = t('vpn-xray-hint', 'Сначала подключитесь к VPN в другом приложении, затем нажмите «Загрузить».');
    if (el.dlBtn()) el.dlBtn().textContent = t('vpn-download-btn', 'Загрузить Xray Core');
    if (el.btnSub()) el.btnSub().textContent = t('vpn-import', 'Импорт');
    if (el.btnAdd()) el.btnAdd().textContent = t('vpn-add', 'Добавить ссылку');
    if (el.url()) el.url().placeholder = t('vpn-url-placeholder', 'https://... (ссылка на подписку)');
    if (el.inpLnk()) el.inpLnk().placeholder = t('vpn-manual-placeholder', 'Вставьте ссылку vless://, vmess://, trojan:// или ss://');
  }

  function serverTypeLabel(type) {
    return String(type || 'VPN').toUpperCase();
  }

  function applyVpnStatus(s) {
    vpnState = s;
    applyVpnLabels();

    const hero = el.hero();
    const dot = el.dot();
    const label = el.label();
    const sub = el.sub();
    const tog = el.tog();
    const bin = el.bin();
    const routeSel = el.routingSelect();

    if (bin) bin.style.display = s.hasBinary ? 'none' : 'block';

    if (routeSel && s.routingMode) {
      routeSel.value = s.routingMode;
    }

    if (s.connected && s.current) {
      hero?.classList.add('connected');
      if (dot) dot.className = 'vpn-dot connected';
      if (label) label.textContent = t('vpn-online', 'VPN Подключен') + ' — ' + s.current.name;
      if (sub) {
        const modeKey = s.routingMode === 'full' ? 'vpn-routing-full' : 'vpn-routing-split';
        const modeLabel = t(modeKey, s.routingMode === 'full' ? 'Весь трафик' : 'Раздельная маршрутизация');
        sub.textContent = `${s.current.address}:${s.current.port} · ${(s.current.type || '').toUpperCase()} · ${modeLabel}`;
      }
      setToggleMode('disconnect');
      if (tog) {
        tog.textContent = t('vpn-disconnect', 'Отключить');
        tog.disabled = false;
      }
      document.getElementById('btn-vpn').style.color = '#4caf50';
    } else {
      hero?.classList.remove('connected');
      if (dot) dot.className = 'vpn-dot';
      if (label) label.textContent = t('vpn-offline', 'VPN Отключен');
      if (sub) {
        sub.textContent = (vpnSelected >= 0 && s.servers[vpnSelected])
          ? t('vpn-selected-label', 'Выбран: ') + s.servers[vpnSelected].name
          : t('vpn-select-server', 'Выберите сервер и нажмите Подключить');
      }
      setToggleMode('connect');
      if (tog) {
        tog.textContent = t('vpn-connect', 'Подключить');
        tog.disabled = vpnSelected < 0 || !s.hasBinary;
      }
      document.getElementById('btn-vpn').style.color = '';
    }

    renderVpnServers(s.servers, s.current);
    if (s.subUrl && el.url()) el.url().value = s.subUrl;
  }

  function serverTypeLabel(type) {
    return (type || 'vpn').slice(0, 4).toUpperCase();
  }

  function renderVpnServers(servers, current) {
    const list = el.lst();
    if (!list) return;

    if (!servers?.length) {
      list.innerHTML = `<div class="vpn-empty">${escHtml(t('vpn-empty', 'Серверы не найдены. Добавьте подписку или ссылку.'))}</div>`;
      return;
    }

    list.innerHTML = servers.map((s, i) => {
      const isActive = current && s.address === current.address && s.port === current.port && s.uuid === current.uuid;
      const isSel = !isActive && vpnSelected === i;
      const ms = serverPings[i];
      let pingHtml = '';
      if (typeof ms === 'number') {
        if (ms > 0) {
          const cls = ms < 100 ? 'good' : ms < 250 ? 'medium' : 'bad';
          pingHtml = `<span class="vpn-ping-badge ${cls}">⚡ ${ms} ms</span>`;
        } else {
          pingHtml = `<span class="vpn-ping-badge bad">⚡ N/A</span>`;
        }
      }
      return `<div class="vpn-server-item${isActive ? ' active' : ''}${isSel ? ' selected' : ''}" data-idx="${i}">
        <span class="vpn-server-type">${escHtml(serverTypeLabel(s.type))}</span>
        <span class="vpn-server-name">${escHtml(s.name)}</span>
        ${pingHtml}
        <span class="vpn-server-info">${escHtml(s.address + ':' + s.port)}</span>
        <button class="vpn-server-del" data-del="${i}" title="Remove">×</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.vpn-server-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('[data-del]')) return;
        const idx = parseInt(item.dataset.idx, 10);
        if (vpnState.connected) vpnConnect(idx);
        else {
          vpnSelected = idx;
          applyVpnStatus(vpnState);
        }
      });
    });

    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.del, 10);
        if (vpnSelected === idx) vpnSelected = -1;
        else if (vpnSelected > idx) vpnSelected--;
        delete serverPings[idx];
        applyVpnStatus(await ipcRenderer.invoke('vpn-remove-server', idx));
      });
    });
  }

  async function refreshVpnStatus() {
    applyVpnStatus(await ipcRenderer.invoke('get-vpn-status'));
  }

  async function vpnConnect(idx) {
    const dot = el.dot();
    const tog = el.tog();
    if (dot) dot.className = 'vpn-dot connecting';
    if (tog) {
      tog.disabled = true;
      tog.textContent = t('vpn-connecting', 'Подключение...');
    }
    const res = await ipcRenderer.invoke('vpn-connect', idx);
    if (!res.ok && typeof toast === 'function') {
      toast(t('toast-vpn-error', 'Ошибка VPN: ') + (res.error || ''));
    }
    await refreshVpnStatus();
  }

  async function vpnDisconnect() {
    const tog = el.tog();
    if (tog) {
      tog.disabled = true;
      tog.textContent = t('vpn-disconnecting', 'Отключение...');
    }
    const res = await ipcRenderer.invoke('vpn-disconnect');
    if (!res.ok && typeof toast === 'function') {
      toast(t('toast-vpn-error', 'Ошибка VPN: ') + res.error);
    }
    await refreshVpnStatus();
  }

  function notifyXrayVpnNeeded() {
    if (typeof toast === 'function') {
      toast(t('toast-xray-need-vpn', 'Для загрузки Xray-core включите VPN (Happ, Hiddify, v2rayN и др.)'));
    }
  }

  document.getElementById('btn-vpn')?.addEventListener('click', async () => {
    openVpn();
    await refreshVpnStatus();
  });

  document.getElementById('btn-close-vpn')?.addEventListener('click', closeVpn);
  el.overlay()?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeVpn();
  });

  el.routingSelect()?.addEventListener('change', async (e) => {
    const mode = e.target.value;
    const res = await ipcRenderer.invoke('vpn-set-routing-mode', mode);
    if (res.ok) {
      if (typeof toast === 'function') {
        toast(mode === 'full' ? 'Режим: Весь трафик' : 'Режим: Раздельный (РФ)');
      }
      applyVpnStatus(res.status);
    }
  });

  el.btnPing()?.addEventListener('click', async () => {
    const btn = el.btnPing();
    if (!btn) return;
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⚡ ...';
    try {
      serverPings = await ipcRenderer.invoke('vpn-ping-servers');
      renderVpnServers(vpnState.servers, vpnState.current);
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });

  el.btnTest()?.addEventListener('click', async () => {
    const btn = el.btnTest();
    if (!btn) return;
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = '🌐 Тестирование...';
    try {
      const res = await ipcRenderer.invoke('vpn-test-connection');
      if (res.ok) {
        const info = [res.ip, res.country, res.city].filter(Boolean).join(', ');
        if (typeof toast === 'function') toast(`🌐 Соединение в норме: ${info}`);
      } else {
        if (typeof toast === 'function') toast(`⚠️ Ошибка подключения: ${res.error}`);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });

  ipcRenderer.on('vpn-status', (e, s) => {
    applyVpnStatus(s);
    document.getElementById('btn-vpn').style.color = s.connected ? '#4caf50' : '';
  });

  el.tog()?.addEventListener('click', () => {
    if (vpnState.connected) vpnDisconnect();
    else if (vpnSelected >= 0) vpnConnect(vpnSelected);
  });

  el.btnSub()?.addEventListener('click', async () => {
    const url = el.url()?.value.trim();
    if (!url) return;
    const btn = el.btnSub();
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('vpn-downloading', 'Загрузка...');
    try {
      const res = await ipcRenderer.invoke('vpn-fetch-sub', url);
      if (res.ok) {
        if (typeof toast === 'function') toast(t('toast-vpn-imported', 'Импортировано: ') + res.servers.length + ' серверов');
        if (vpnSelected < 0 && res.servers?.length) vpnSelected = 0;
        await refreshVpnStatus();
      } else {
        if (typeof toast === 'function') toast(t('toast-vpn-error', 'Ошибка VPN: ') + res.error);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });

  el.btnAdd()?.addEventListener('click', async () => {
    const link = el.inpLnk()?.value.trim();
    if (!link) return;
    const btn = el.btnAdd();
    const oldTxt = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('vpn-downloading', 'Загрузка...');
    try {
      const res = await ipcRenderer.invoke('vpn-add-link', link);
      if (res.ok) {
        if (el.inpLnk()) el.inpLnk().value = '';
        if (typeof toast === 'function') toast(t('toast-vpn-added', 'Добавлено: ') + res.added.length + ' серверов');
        if (vpnSelected < 0 && res.added?.length) vpnSelected = vpnState.servers.length - res.added.length;
        await refreshVpnStatus();
      } else {
        if (typeof toast === 'function') toast(t('toast-vpn-error', 'Ошибка VPN: ') + res.error);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });

  el.dlBtn()?.addEventListener('click', async () => {
    notifyXrayVpnNeeded();

    const btn = el.dlBtn();
    const prog = document.getElementById('vpn-dl-progress');
    const fill = document.getElementById('vpn-dl-fill');
    const oldTxt = btn.textContent;

    btn.disabled = true;
    btn.textContent = t('vpn-pending', 'Ожидание...');
    prog?.classList.add('show');

    const onProg = (e, pct) => {
      if (fill) fill.style.width = pct + '%';
      btn.textContent = t('vpn-downloading-progress', 'Загрузка ') + pct + '%';
    };
    ipcRenderer.on('vpn-download-progress', onProg);

    const res = await ipcRenderer.invoke('vpn-download-binary');
    ipcRenderer.removeListener('vpn-download-progress', onProg);
    prog?.classList.remove('show');
    btn.disabled = false;
    btn.textContent = oldTxt;

    if (res.ok) {
      if (typeof toast === 'function') toast(t('toast-xray-ready', 'Xray готов'));
      await refreshVpnStatus();
    } else {
      if (typeof toast === 'function') toast(t('toast-xray-need-vpn', 'Не удалось загрузить. Включите VPN (Happ, Hiddify, v2rayN и др.) и попробуйте снова.'));
    }
  });

  applyVpnLabels();
  window.applyVpnLabels = applyVpnLabels;
  window.refreshVpnStatus = refreshVpnStatus;
})();

