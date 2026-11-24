'use strict';

/** Map keyboard input → browser action id (main + renderer). */
function matchShortcut(input) {
  if (!input || input.type !== 'keyDown') return null;

  const ctrl = !!(input.control || input.meta);
  const shift = !!input.shift;
  const alt = !!input.alt;
  const key = input.key || '';
  const k = key.length === 1 ? key.toLowerCase() : key;

  if (ctrl && !shift && k === 't') return 'new-tab';
  if (ctrl && shift && k === 't') return 'reopen-tab';
  if (ctrl && !shift && k === 'w') return 'close-tab';
  if (ctrl && !shift && key === 'Tab') return 'next-tab';
  if (ctrl && shift && key === 'Tab') return 'prev-tab';
  if (ctrl && !shift && k === 'r') return 'reload';
  if (ctrl && shift && k === 'r') return 'hard-reload';
  if (key === 'F5') return 'reload';
  if ((ctrl && k === 'l') || key === 'F6') return 'focus-url';
  if (ctrl && !shift && k === 'h') return 'toggle-sidebar';
  if (ctrl && !shift && k === 'j') return 'toggle-downloads';
  if (ctrl && shift && k === 'n') return 'incognito';
  if (ctrl && !shift && k === 'd') return 'bookmark';
  if (ctrl && shift && k === 'b') return 'toggle-bookmarks-bar';
  if (ctrl && shift && k === 'c') return 'copy-url';
  if (ctrl && shift && k === 'o') return 'open-bookmarks';
  if (ctrl && shift && k === 'a') return 'tab-search';
  if (ctrl && (k === '=' || key === '+' || key === 'Add')) return 'zoom-in';
  if (ctrl && (k === '-' || key === 'Subtract')) return 'zoom-out';
  if (ctrl && k === '0') return 'zoom-reset';
  if (alt && key === 'ArrowLeft') return 'back';
  if (alt && key === 'ArrowRight') return 'forward';
  if (ctrl && shift && key === 'Delete') return 'clear-history';
  if (ctrl && shift && k === 's') return 'screenshot';
  if ((ctrl || input.meta) && k === 'f') return 'find';
  if (alt && k === 'p') return 'pip';
  if (alt && k === 't') return 'translate';
  if (key === 'F9') return 'reader-mode';
  if (key === 'F12' && shift) return 'perf-monitor';
  if (key === 'F12') return 'devtools';
  if (key === 'Escape') return 'escape';

  if (ctrl && k >= '1' && k <= '9') return 'tab-' + k;

  return null;
}

module.exports = { matchShortcut };
