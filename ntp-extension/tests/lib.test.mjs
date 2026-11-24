import { test } from 'node:test';
import assert from 'node:assert/strict';

import { skyAt, greetingKey } from '../lib/sky.js';
import { conditionKey, formatTemp, findCity, currentWeather, locateByIp } from '../lib/weather.js';
import { hostOf, tileLabel, tileLetter, pickShortcuts, pickRecent, STARTER_SITES } from '../lib/sites.js';
import { parseGoogleSuggestions, historyToSuggestions, mergeSuggestions } from '../lib/suggestions.js';

test('sky: keyframes are hit exactly and the day wraps around', () => {
  assert.deepEqual(skyAt(0), { zenith: '#070a16', horizon: '#0e1220', glow: '#818cf8', strength: 0.1 });
  assert.deepEqual(skyAt(7), { zenith: '#1b2550', horizon: '#6b4a5e', glow: '#f5c26b', strength: 0.45 });
  assert.deepEqual(skyAt(24), skyAt(0));
  assert.deepEqual(skyAt(-1), skyAt(23));
});

test('sky: every minute of the day gives valid colours', () => {
  for (let m = 0; m < 24 * 60; m++) {
    const s = skyAt(m / 60);
    for (const c of [s.zenith, s.horizon, s.glow]) assert.match(c, /^#[0-9a-f]{6}$/);
    assert.ok(s.strength >= 0.1 && s.strength <= 0.45);
  }
});

test('greeting by hour', () => {
  assert.equal(greetingKey(4), 'greetNight');
  assert.equal(greetingKey(5), 'greetMorning');
  assert.equal(greetingKey(12), 'greetDay');
  assert.equal(greetingKey(17), 'greetEvening');
  assert.equal(greetingKey(22), 'greetNight');
});

test('weather codes map to conditions', () => {
  assert.equal(conditionKey(0), 'wxClear');
  assert.equal(conditionKey(2), 'wxPartly');
  assert.equal(conditionKey(48), 'wxFog');
  assert.equal(conditionKey(53), 'wxDrizzle');
  assert.equal(conditionKey(66), 'wxFreezing');
  assert.equal(conditionKey(63), 'wxRain');
  assert.equal(conditionKey(77), 'wxSnow');
  assert.equal(conditionKey(86), 'wxSnow');
  assert.equal(conditionKey(81), 'wxShowers');
  assert.equal(conditionKey(99), 'wxThunder');
  assert.equal(conditionKey(undefined), 'wxUnknown');
});

test('temperature formatting', () => {
  assert.equal(formatTemp(-3.4), '\u22123°');
  assert.equal(formatTemp(-0.2), '0°');
  assert.equal(formatTemp(21.5), '22°');
});

const fakeFetch = (body, ok = true, status = 200) => {
  const calls = [];
  const fn = async (url) => { calls.push(url); return { ok, status, json: async () => body }; };
  fn.calls = calls;
  return fn;
};

test('findCity encodes the query and returns the first hit', async () => {
  const f = fakeFetch({ results: [{ name: 'Казань', latitude: 55.79, longitude: 49.12 }] });
  assert.deepEqual(await findCity('Казань & Ко', 'ru', f), { name: 'Казань', lat: 55.79, lon: 49.12 });
  assert.ok(f.calls[0].includes('name=%D0%9A%D0%B0%D0%B7%D0%B0%D0%BD%D1%8C%20%26%20%D0%9A%D0%BE'));
  assert.equal(await findCity('zzzz', 'ru', fakeFetch({})), null);
  await assert.rejects(findCity('x', 'ru', fakeFetch({}, false, 500)), /GEO_HTTP_500/);
});

test('currentWeather reads the current block and rejects empty answers', async () => {
  const f = fakeFetch({ current: { temperature_2m: -2.6, weather_code: 73 } });
  assert.deepEqual(await currentWeather({ lat: 1, lon: 2 }, f), { temp: -2.6, code: 73 });
  await assert.rejects(currentWeather({ lat: 1, lon: 2 }, fakeFetch({})), /WX_EMPTY/);
});

test('locateByIp: uses ipwhois.app when it answers', async () => {
  const f = fakeFetch({ success: true, city: 'Копейск', latitude: 55.11, longitude: 61.61 });
  assert.deepEqual(await locateByIp(f), { name: 'Копейск', lat: 55.11, lon: 61.61 });
  assert.equal(f.calls[0], 'https://ipwhois.app/json/');
});

test('locateByIp: falls back to wttr.in when ipwhois.app fails or has nothing', async () => {
  let n = 0;
  const f = async (url) => {
    n++;
    if (url.includes('ipwhois')) return { ok: false, status: 500, json: async () => ({}) };
    return {
      ok: true,
      json: async () => ({
        nearest_area: [{ areaName: [{ value: 'Челябинск' }], latitude: '55.16', longitude: '61.40' }],
      }),
    };
  };
  assert.deepEqual(await locateByIp(f), { name: 'Челябинск', lat: 55.16, lon: 61.40 });
  assert.equal(n, 2);
});

test('locateByIp: null when every provider fails', async () => {
  const f = async () => { throw new Error('offline'); };
  assert.equal(await locateByIp(f), null);
});

test('hostOf accepts only web pages', () => {
  assert.equal(hostOf('https://www.example.com/a'), 'example.com');
  assert.equal(hostOf('chrome://settings'), '');
  assert.equal(hostOf('file:///C:/x.html'), '');
  assert.equal(hostOf('nonsense'), '');
});

test('tile label and letter', () => {
  assert.equal(tileLabel({ title: 'YouTube', url: 'https://www.youtube.com/' }), 'YouTube');
  assert.equal(tileLabel({ title: 'A very long page title that will not fit', url: 'https://news.example.org/x' }), 'news.example.org');
  assert.equal(tileLabel({ title: '', url: 'https://example.org/' }), 'example.org');
  assert.equal(tileLetter({ title: 'яндекс', url: 'https://ya.ru' }), 'Я');
  assert.equal(tileLetter({ title: '', url: 'https://example.org' }), 'E');
});

test('shortcuts: one per host, capped, starter set on a fresh profile', () => {
  const top = [
    { title: 'A', url: 'https://a.example/' },
    { title: 'A2', url: 'https://www.a.example/page' },
    { title: 'Settings', url: 'chrome://settings/' },
    { title: 'B', url: 'https://b.example/' },
  ];
  assert.deepEqual(pickShortcuts(top).map((s) => s.title), ['A', 'B']);
  assert.equal(pickShortcuts(top, 1).length, 1);
  const fresh = pickShortcuts([]);
  assert.equal(fresh.length, STARTER_SITES.length);
  assert.ok(fresh.every((s) => s.own === false));
});

test('recent: newest first, one per host, not repeating shortcuts', () => {
  const shortcuts = pickShortcuts([{ title: 'A', url: 'https://a.example/' }]);
  const history = [
    { title: 'old c', url: 'https://c.example/1', lastVisitTime: 1 },
    { title: 'a page', url: 'https://a.example/x', lastVisitTime: 9 },
    { title: 'new c', url: 'https://c.example/2', lastVisitTime: 5 },
    { title: '', url: 'https://d.example/', lastVisitTime: 3 },
    { title: 'ext', url: 'chrome-extension://abc/page.html', lastVisitTime: 8 },
  ];
  assert.deepEqual(pickRecent(history, shortcuts), [
    { title: 'new c', url: 'https://c.example/2', host: 'c.example' },
    { title: 'd.example', url: 'https://d.example/', host: 'd.example' },
  ]);
  // Starter tiles are not the user's own sites, so they do not hide history.
  assert.equal(pickRecent([{ title: 'yt', url: 'https://www.youtube.com/watch', lastVisitTime: 1 }], pickShortcuts([])).length, 1);
});

test('parseGoogleSuggestions reads the second JSONP array and caps it', () => {
  assert.deepEqual(parseGoogleSuggestions(['q', ['a', 'b', 'c']], 2), [
    { type: 'search', text: 'a', url: null },
    { type: 'search', text: 'b', url: null },
  ]);
  assert.deepEqual(parseGoogleSuggestions(['q'], 6), []);
  assert.deepEqual(parseGoogleSuggestions(null, 6), []);
});

test('historyToSuggestions dedupes by title and caps the count', () => {
  const items = [
    { title: 'Example', url: 'https://example.com/a' },
    { title: 'example', url: 'https://example.com/b' },
    { title: '', url: 'https://example.com/c' },
    { title: 'Other', url: 'https://other.example/' },
  ];
  assert.deepEqual(historyToSuggestions(items, 5), [
    { type: 'history', text: 'Example', url: 'https://example.com/a' },
    { type: 'history', text: 'Other', url: 'https://other.example/' },
  ]);
  assert.equal(historyToSuggestions(items, 1).length, 1);
  assert.deepEqual(historyToSuggestions(undefined), []);
});

test('mergeSuggestions puts history first only when there is any', () => {
  const h = [{ type: 'history', text: 'a', url: 'https://a' }];
  const s = [{ type: 'search', text: 'b', url: null }];
  assert.deepEqual(mergeSuggestions(h, s), [...h, ...s]);
  assert.deepEqual(mergeSuggestions([], s), s);
});
