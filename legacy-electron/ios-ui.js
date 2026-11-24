'use strict';

/** iOS-style segmented control + animated panel switching */
(function () {
  function isSegmentLayoutStable(group) {
    const sidebar = group.closest('#sidebar');
    if (!sidebar) return group.offsetWidth > 48;
    if (!sidebar.classList.contains('open')) return false;
    return sidebar.offsetWidth >= 340;
  }

  function updateSegmentIndicator(group) {
    const indicator = group.querySelector('.ios-seg-indicator');
    const active = group.querySelector('.ios-seg-btn.active');
    if (!indicator || !active) return;

    if (active.offsetWidth < 2 || !isSegmentLayoutStable(group)) {
      indicator.classList.remove('is-ready');
      return;
    }

    const wasReady = indicator.classList.contains('is-ready');
    if (!wasReady) indicator.classList.add('no-transition');

    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    indicator.classList.add('is-ready');

    if (!wasReady) {
      void indicator.offsetWidth;
      indicator.classList.remove('no-transition');
    }
  }

  function scheduleSegmentIndicatorUpdate(group) {
    if (!group) return;
    updateSegmentIndicator(group);
    requestAnimationFrame(() => {
      updateSegmentIndicator(group);
      requestAnimationFrame(() => updateSegmentIndicator(group));
    });
    clearTimeout(group._segLayoutTimer);
    group._segLayoutTimer = setTimeout(() => updateSegmentIndicator(group), 480);
  }

  function observeSegmentLayout(group) {
    if (!group || group._segObs) return;
    let debounce;
    const ro = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => updateSegmentIndicator(group), 24);
    });
    ro.observe(group);
    const sidebar = group.closest('#sidebar');
    if (sidebar) ro.observe(sidebar);
    group._segObs = ro;
  }

  function pulseSegment(group) {
    group.classList.add('ios-seg-tap');
    clearTimeout(group._segTapTimer);
    group._segTapTimer = setTimeout(() => group.classList.remove('ios-seg-tap'), 180);
  }

  function initSettingGroups() {
    document.querySelectorAll('.setting-group').forEach(group => {
      if (group.querySelector('.setting-group-card')) return;
      const title = group.querySelector('.setting-group-title');
      const rows = [...group.children].filter(el => el !== title && !el.classList.contains('setting-group-card'));
      if (!rows.length) return;
      const card = document.createElement('div');
      card.className = 'setting-group-card';
      rows.forEach(row => card.appendChild(row));
      group.appendChild(card);
    });
  }

  function replayAnimations(root, selector) {
    if (!root) return;
    root.querySelectorAll(selector).forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }

  function refreshListAnimations(panelEl) {
    if (!panelEl) return;
    const items = panelEl.querySelectorAll('.ios-list-group, .history-item, .bm-item');
    const limit = Math.min(items.length, 30);
    for (let i = 0; i < limit; i++) {
      items[i].style.animation = 'none';
      void items[i].offsetWidth;
      items[i].style.animation = '';
    }
  }

  function refreshSettingsAnimations() {
    const modal = document.getElementById('settings-modal');
    const panel = modal?.querySelector('.settings-panel.active');
    replayAnimations(modal, '.modal-header, .settings-nav-wrap, .settings-body, .settings-footer');
    replayAnimations(panel, '.setting-group, .setting-group-card .setting-row');
  }

  function initSegmentedGroup(group) {
    if (!group || group.dataset.iosInit) return;
    group.dataset.iosInit = '1';

    if (!group.querySelector('.ios-seg-indicator')) {
      const ind = document.createElement('span');
      ind.className = 'ios-seg-indicator';
      group.insertBefore(ind, group.firstChild);
    }

    group.querySelectorAll('.ios-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        pulseSegment(group);
        if (btn.dataset.panel) {
          window.iosUI.switchSidebarPanel(btn.dataset.panel);
          if (btn.dataset.panel === 'history' && typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-history');
          if (btn.dataset.panel === 'bookmarks' && typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-bookmarks');
        } else if (btn.dataset.stab) {
          window.iosUI.switchSettingsPanel(btn.dataset.stab);
        }
      });
    });

    requestAnimationFrame(() => scheduleSegmentIndicatorUpdate(group));
    window.addEventListener('resize', () => scheduleSegmentIndicatorUpdate(group));
    observeSegmentLayout(group);
  }

  function initAllSegmented() {
    document.querySelectorAll('.ios-segmented').forEach(initSegmentedGroup);
  }

  function switchPanelAnimated(viewport, panelEl, forward) {
    if (!viewport || !panelEl) return;
    const current = viewport.querySelector('.sidebar-panel.active, .settings-panel.active');
    if (current === panelEl) return;

    const exitClass = forward ? 'ios-exit-left' : 'ios-exit-right';
    const enterClass = forward ? 'ios-enter-right' : 'ios-enter-left';

    if (current) {
      current.classList.add(exitClass);
      current.classList.remove('active');
    }

    panelEl.classList.add('ios-panel-visible', enterClass);
    void panelEl.offsetWidth;
    panelEl.classList.add('active');
    panelEl.classList.remove(enterClass);

    const cleanup = () => {
      if (current) current.classList.remove(exitClass, 'ios-panel-visible');
      panelEl.classList.remove('ios-panel-visible');
      if (panelEl.classList.contains('settings-panel')) {
        replayAnimations(panelEl, '.setting-group, .setting-group-card .setting-row');
      }
    };
    setTimeout(cleanup, 400);
  }

  function panelIndex(viewport, el) {
    if (!el) return -1;
    return [...viewport.querySelectorAll('.sidebar-panel, .settings-panel')].indexOf(el);
  }

  window.iosUI = {
    initAllSegmented,
    initSettingGroups,
    refreshSettingsAnimations,
    updateSegmentIndicator(group) {
      if (group) updateSegmentIndicator(group);
    },
    refreshAllIndicators() {
      document.querySelectorAll('.ios-segmented').forEach(scheduleSegmentIndicatorUpdate);
    },

    switchSidebarPanel(panelName) {
      const viewport = document.querySelector('.sidebar-panels-viewport');
      const next = document.getElementById('panel-' + panelName);
      const segments = document.getElementById('sidebar-segments');
      if (!next || !viewport) return;

      const current = viewport.querySelector('.sidebar-panel.active');
      const forward = panelIndex(viewport, next) > panelIndex(viewport, current);

      if (segments) {
        segments.querySelectorAll('.ios-seg-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.panel === panelName);
        });
        scheduleSegmentIndicatorUpdate(segments);
      }

      if (panelName === 'history') {
        const histList = document.getElementById('history-list');
        if (histList) histList.scrollTop = 0;
        if (typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-history');
      } else if (panelName === 'bookmarks') {
        if (typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-bookmarks');
      }

      switchPanelAnimated(viewport, next, forward);
    },

    switchSettingsPanel(stabName) {
      const viewport = document.querySelector('.settings-panels-viewport');
      const next = document.getElementById('stab-' + stabName);
      const segments = document.getElementById('settings-segments');
      if (!next || !viewport) return;

      const current = viewport.querySelector('.settings-panel.active');
      const forward = panelIndex(viewport, next) > panelIndex(viewport, current);

      if (segments) {
        segments.querySelectorAll('.ios-seg-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.stab === stabName);
        });
        scheduleSegmentIndicatorUpdate(segments);
      }

      switchPanelAnimated(viewport, next, forward);
    },

    openSidebar(panel = 'history') {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      const wasOpen = sidebar.classList.contains('open');
      const activePanel = document.querySelector('.sidebar-panel.active')?.id?.replace('panel-', '');
      sidebar.classList.add('open');
      document.getElementById('sidebar-backdrop')?.classList.add('active');
      document.getElementById('btn-sidebar')?.classList.add('active');
      if (!wasOpen || activePanel !== panel) {
        window.iosUI.switchSidebarPanel(panel);
      }
      if (panel === 'history') {
        const histList = document.getElementById('history-list');
        if (histList) histList.scrollTop = 0;
        if (typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-history');
      } else if (panel === 'bookmarks') {
        if (typeof ipcRenderer !== 'undefined') ipcRenderer.send('get-bookmarks');
        setTimeout(() => document.getElementById('bookmarks-search')?.focus(), 220);
      }


      const seg = document.getElementById('sidebar-segments');
      if (!wasOpen) {
        seg?.querySelector('.ios-seg-indicator')?.classList.remove('is-ready');
      }
      scheduleSegmentIndicatorUpdate(seg);

      const onSidebarReady = (e) => {
        if (e && e.propertyName && e.propertyName !== 'transform') return;
        scheduleSegmentIndicatorUpdate(seg);
        sidebar.removeEventListener('transitionend', onSidebarReady);
      };
      if (!wasOpen) sidebar.addEventListener('transitionend', onSidebarReady);

      requestAnimationFrame(() => {
        refreshListAnimations(document.getElementById('panel-' + panel));
      });
    },

    closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar?.classList.contains('open')) return;
      sidebar.classList.add('closing');
      document.getElementById('sidebar-backdrop')?.classList.remove('active');
      document.getElementById('sidebar-segments')
        ?.querySelector('.ios-seg-indicator')
        ?.classList.remove('is-ready');
      setTimeout(() => {
        sidebar.classList.remove('open', 'closing');
        document.getElementById('btn-sidebar')?.classList.remove('active');
      }, 380);
    },

    toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      if (sidebar.classList.contains('open')) window.iosUI.closeSidebar();
      else window.iosUI.openSidebar('history');
    }
  };

  function initSidebarBackdrop() {
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop && !backdrop.dataset.init) {
      backdrop.dataset.init = 'true';
      backdrop.addEventListener('click', () => {
        if (window.iosUI) window.iosUI.closeSidebar();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAllSegmented();
      initSettingGroups();
      initSidebarBackdrop();
    });
  } else {
    initAllSegmented();
    initSettingGroups();
    initSidebarBackdrop();
  }
})();
