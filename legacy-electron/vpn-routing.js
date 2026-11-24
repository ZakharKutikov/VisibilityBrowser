'use strict';

/** Geosite / domain rules for services commonly blocked in Russia */
const RU_BLOCKED_GEOSITE = [
  'geosite:youtube',
  'geosite:google',
  'geosite:twitter',
  'geosite:facebook',
  'geosite:instagram',
  'geosite:telegram',
  'geosite:discord',
  'geosite:tiktok',
  'geosite:openai',
  'geosite:netflix',
  'geosite:spotify',
  'geosite:linkedin',
  'geosite:whatsapp',
  'geosite:reddit',
  'geosite:medium',
  'geosite:twitch',
  'geosite:github',
];

const RU_BLOCKED_DOMAINS = [
  'domain:twitter.com',
  'domain:x.com',
  'domain:twimg.com',
  'domain:t.co',
  'domain:facebook.com',
  'domain:fbcdn.net',
  'domain:instagram.com',
  'domain:cdninstagram.com',
  'domain:youtube.com',
  'domain:youtu.be',
  'domain:googlevideo.com',
  'domain:ytimg.com',
  'domain:discord.com',
  'domain:discordapp.com',
  'domain:discord.gg',
  'domain:discord.media',
  'domain:discordapp.net',
  'domain:telegram.org',
  'domain:t.me',
  'domain:telesco.pe',
  'domain:tiktok.com',
  'domain:tiktokcdn.com',
  'domain:openai.com',
  'domain:chatgpt.com',
  'domain:oaistatic.com',
  'domain:anthropic.com',
  'domain:claude.ai',
  'domain:netflix.com',
  'domain:nflxvideo.net',
  'domain:spotify.com',
  'domain:scdn.co',
  'domain:linkedin.com',
  'domain:licdn.com',
  'domain:whatsapp.com',
  'domain:whatsapp.net',
  'domain:reddit.com',
  'domain:redd.it',
  'domain:redditstatic.com',
  'domain:medium.com',
  'domain:twitch.tv',
  'domain:twitchcdn.net',
  'domain:ttvnw.net',
  'domain:threads.net',
  'domain:soundcloud.com',
  'domain:bbc.com',
  'domain:bbc.co.uk',
  'domain:dropbox.com',
  'domain:dropboxusercontent.com',
  'domain:signal.org',
  'domain:signal.art',
  'domain:notion.so',
  'domain:notion.site',
  'domain:figma.com',
  'domain:canva.com',
  'domain:slack.com',
  'domain:slack-edge.com',
  'domain:zoom.us',
  'domain:zoom.com',
  'domain:proton.me',
  'domain:protonmail.com',
  'domain:protonvpn.com',
  'domain:rutracker.org',
  'domain:rutracker.net',
  'domain:rutracker.wiki',
  'domain:kinozal.tv',
  'domain:nnmclub.to',
  'domain:flibusta.is',
  'domain:browser-api.com',
];

function normalizeCustomDomain(line) {
  const raw = String(line || '').trim();
  if (!raw || raw.startsWith('#')) return null;
  if (raw.startsWith('geosite:') || raw.startsWith('domain:') || raw.startsWith('full:')) return raw;
  if (raw.startsWith('*.')) return `domain:${raw.slice(2)}`;
  return `domain:${raw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]}`;
}

function buildRoutingRules(mode, customLines = []) {
  const rules = [
    { type: 'field', ip: ['geoip:private'], outboundTag: 'direct' },
    { type: 'field', domain: ['geosite:private'], outboundTag: 'direct' },
  ];

  const custom = customLines.map(normalizeCustomDomain).filter(Boolean);

  if (mode === 'split-ru') {
    const proxyDomains = [...new Set([...RU_BLOCKED_GEOSITE, ...RU_BLOCKED_DOMAINS, ...custom])];
    rules.push({ type: 'field', domain: proxyDomains, outboundTag: 'proxy' });
    rules.push({ type: 'field', network: 'tcp,udp', outboundTag: 'direct' });
  } else {
    rules.push({ type: 'field', port: '0-65535', outboundTag: 'proxy' });
    rules.push({ type: 'field', network: 'tcp,udp', outboundTag: 'proxy' });
  }

  return {
    domainStrategy: 'IPIfNonMatch',
    rules,
  };
}

module.exports = {
  RU_BLOCKED_GEOSITE,
  RU_BLOCKED_DOMAINS,
  normalizeCustomDomain,
  buildRoutingRules,
};

