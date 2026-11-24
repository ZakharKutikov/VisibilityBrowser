'use strict';

const GOMP_DEFAULT_SUFFIXES = ['gomp.su', 'zapreta-net.tech'];

function getHostnameFromUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return String(url).replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  }
}

function hostMatchesSuffix(host, suffix) {
  const s = String(suffix || '').toLowerCase().replace(/^\*\./, '').replace(/^\./, '');
  if (!s || !host) return false;
  return host === s || host.endsWith('.' + s);
}

function isGompTrustedDomain(url, extraDomains) {
  const host = getHostnameFromUrl(url);
  if (!host) return false;
  const extras = Array.isArray(extraDomains) ? extraDomains : [];
  const all = [...GOMP_DEFAULT_SUFFIXES, ...extras];
  return all.some((suffix) => hostMatchesSuffix(host, suffix));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getHostnameFromUrl, hostMatchesSuffix, isGompTrustedDomain, GOMP_DEFAULT_SUFFIXES };
}
if (typeof window !== 'undefined') {
  window.gompTrusted = { getHostnameFromUrl, hostMatchesSuffix, isGompTrustedDomain, GOMP_DEFAULT_SUFFIXES };
}
