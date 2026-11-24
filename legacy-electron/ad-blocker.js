'use strict';


const AD_HOST_SUFFIXES = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'ads.youtube.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'googlesyndication.com',
  'adsense.google.com',
  'adwords.google.com',

  'facebook.net',              // fb tracking pixel
  'connect.facebook.net',
  'pixel.facebook.com',
  'an.facebook.com',           // audience network
  'graph.facebook.com',

  'amazon-adsystem.com',
  'aax.amazon-adsystem.com',
  'fls-na.amazon.com',
  'mads.amazon.com',

  'ads.bing.com',
  'bat.bing.com',
  'c.bing.com',
  'clarity.ms',

  'ads-twitter.com',
  'ads-api.twitter.com',
  'analytics.twitter.com',
  'static.ads-twitter.com',
  't.co',

  'analytics.tiktok.com',
  'ads.tiktok.com',
  'log.byteoversea.com',
  'ad.tiktok.com',

  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'smartadserver.com',
  'adnxs.com',
  'advertising.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'quantcount.com',
  'adsrvr.org',
  'adroll.com',
  'demdex.net',
  'contextweb.com',
  'bidswitch.net',
  'casalemedia.com',
  'sharethrough.com',
  'mathtag.com',
  'yieldmo.com',
  'indexexchange.com',
  'media.net',
  'revcontent.com',
  'mgid.com',
  'propellerads.com',
  'adcolony.com',
  'unityads.unity3d.com',      // Unity Ads
  'mopub.com',
  'applovin.com',
  'inmobi.com',
  'chartboost.com',
  'vungle.com',
  'ironsrc.com',               // ironSource
  'startapp.com',
  'tapjoy.com',

  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'heapanalytics.com',
  'fullstory.com',
  'mouseflow.com',
  'crazyegg.com',
  'luckyorange.com',
  'hubspot.com',
  'marketo.net',
  'marketo.com',
  'pardot.com',
  'munchkin.marketo.net',
  'optimizely.com',
  'omtrdc.net',
  'demdex.net',
  'bluekai.com',
  'krxd.net',
  'exelator.com',
  'eyeota.net',
  'rlcdn.com',
  'turn.com',
  'agkn.com',
  'bounceexchange.com',
  'liadm.com',
  'pippio.com',
  'company-target.com',
  'demandbase.com',

  'adfox.yandex.ru',
  'yandexadexchange.net',
  'an.yandex.ru',
  'mc.yandex.ru',
  'metrika.yandex.ru',
  'top-fwz1.mail.ru',
  'ad.mail.ru',
  'rs.mail.ru',
  'mytarget.com',
  'top100.rambler.ru',
  'counter.yadro.ru',
  'adriver.ru',
  'begun.ru',
  'marketgid.com',
  'smi2.ru',

  'track.adform.net',
  'serving-sys.com',
  'smaato.net',
  'eyeblaster.com',
  'clicktale.net',
  'nexac.com',

  'popads.net',
  'popcash.net',
  'juicyads.com',
  'exoclick.com',
  'trafficjunky.net',
  'trafficfactory.biz',
  'clickadu.com',
  'hilltopads.net',
  'adcash.com',
  'richpush.com',
  'push.house',
  'pushwoosh.com',
  'onesignal.com',
];

const AD_HOST_SET = new Set(AD_HOST_SUFFIXES);

function shouldBlockAdUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (AD_HOST_SET.has(host)) return true;
    const parts = host.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join('.');
      if (AD_HOST_SET.has(suffix)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const sessions = new WeakMap();

function applyAdBlocker(sess, enabled) {
  if (!sess || typeof sess.webRequest?.onBeforeRequest !== 'function') return;

  let state = sessions.get(sess);
  if (!state) {
    state = { enabled: false, attached: false };
    sessions.set(sess, state);
  }

  state.enabled = !!enabled;

  if (state.attached) return;

  sess.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    const st = sessions.get(sess);
    if (st && st.enabled && shouldBlockAdUrl(details.url)) {
      callback({ cancel: true });
      return;
    }
    callback({ cancel: false });
  });

  state.attached = true;
}

module.exports = { shouldBlockAdUrl, applyAdBlocker, AD_HOST_SUFFIXES };
