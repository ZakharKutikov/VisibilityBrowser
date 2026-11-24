'use strict';

const { ipcMain, webContents } = require('electron');

function setupTabPerformance() {
  const guestState = new Map();

  ipcMain.on('guest-tab-active', (e, { guestId, active }) => {
    if (!guestId) return;
    const wc = webContents.fromId(guestId);
    if (!wc || wc.isDestroyed()) return;

    guestState.set(guestId, !!active);

    try {
      wc.setBackgroundThrottling(false);
    } catch (err) {}
  });

  ipcMain.on('guest-tab-release', (e, guestId) => {
    if (guestId) guestState.delete(guestId);
  });
}

module.exports = { setupTabPerformance };
