const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findRcedit() {
  const cacheBase = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  if (!fs.existsSync(cacheBase)) return null;
  const entries = fs.readdirSync(cacheBase);
  for (const entry of entries) {
    const candidate = path.join(cacheBase, entry, 'rcedit-x64.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

exports.default = async function(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  const exePath = path.join(appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const root = context.packager.projectDir;
  const icon = path.join(root, 'icon.ico');
  const rcedit = findRcedit();

  if (!rcedit) {
    console.warn('[afterPack] rcedit-x64.exe not found, skipping icon injection.');
    return;
  }
  if (!fs.existsSync(exePath)) {
    console.warn('[afterPack] Target exe not found:', exePath);
    return;
  }
  if (!fs.existsSync(icon)) {
    console.warn('[afterPack] icon.ico not found at:', icon);
    return;
  }

  try {
    execFileSync(rcedit, [exePath, '--set-icon', icon]);
    console.log('[afterPack] Successfully embedded custom icon into:', path.basename(exePath));
  } catch (err) {
    console.warn('[afterPack] Failed to inject icon:', err.message);
  }
};
