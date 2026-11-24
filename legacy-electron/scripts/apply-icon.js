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

const root = path.join(__dirname, '..');
const rcedit = findRcedit();
const icon = path.join(root, 'icon.ico');

if (!rcedit) {
  console.warn('[postbuild] rcedit-x64.exe not found in electron-builder cache, skipping.');
  process.exit(0);
}

if (!fs.existsSync(icon)) {
  console.warn('[postbuild] icon.ico not found, skipping.');
  process.exit(0);
}

const targets = [
  path.join(root, 'build-output', 'win-unpacked', 'Visibility Browser.exe'),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    try {
      execFileSync(rcedit, [target, '--set-icon', icon]);
      console.log('[postbuild] Successfully applied custom icon to:', path.basename(target));
    } catch (err) {
      console.warn('[postbuild] Failed to apply icon to', path.basename(target), ':', err.message);
    }
  }
}
