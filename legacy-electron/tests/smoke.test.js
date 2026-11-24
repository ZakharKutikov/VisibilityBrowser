'use strict';

const assert = require('assert');
const { matchShortcut } = require('../shortcuts-shared');
const { isGompTrustedDomain, hostMatchesSuffix } = require('../gomp-trusted');
const { shouldBlockAdUrl } = require('../ad-blocker');
const { buildRoutingRules, normalizeCustomDomain } = require('../vpn-routing');

function testVpnRouting() {
  const split = buildRoutingRules('split-ru', ['example.com']);
  assert.strictEqual(split.rules[split.rules.length - 1].outboundTag, 'direct');
  assert.ok(split.rules.some(r => r.outboundTag === 'proxy' && r.domain?.includes('geosite:youtube')));
  assert.ok(split.rules.some(r => r.domain?.includes('domain:example.com')));

  const full = buildRoutingRules('full');
  assert.strictEqual(full.rules[full.rules.length - 1].outboundTag, 'proxy');
  assert.strictEqual(normalizeCustomDomain('*.foo.bar'), 'domain:foo.bar');
}

function testShortcuts() {
  assert.strictEqual(matchShortcut({ type: 'keyDown', control: true, shift: true, key: 'a' }), 'tab-search');
  assert.strictEqual(matchShortcut({ type: 'keyDown', control: true, key: 't' }), 'new-tab');
  assert.strictEqual(matchShortcut({ type: 'keyDown', key: 'F9' }), 'reader-mode');
}

function testGompTrusted() {
  assert.strictEqual(isGompTrustedDomain('https://api.gomp.su/x'), true);
  assert.strictEqual(isGompTrustedDomain('https://zapreta-net.tech'), true);
  assert.strictEqual(isGompTrustedDomain('https://google.com'), false);
  assert.strictEqual(isGompTrustedDomain('https://x.com', ['example.com']), false);
  assert.strictEqual(isGompTrustedDomain('https://sub.example.com', ['example.com']), true);
  assert(hostMatchesSuffix('a.gomp.su', 'gomp.su'));
}

function testAdBlock() {
  assert.strictEqual(shouldBlockAdUrl('https://pagead2.googlesyndication.com/pagead/js'), true);
  assert.strictEqual(shouldBlockAdUrl('https://www.google.com/search?q=test'), false);
}

testShortcuts();
testGompTrusted();
testAdBlock();
testVpnRouting();
console.log('smoke tests passed');
