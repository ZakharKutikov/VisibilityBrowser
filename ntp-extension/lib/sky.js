// The new tab page is a sky that follows the local time: the colours of the zenith,
// the horizon and the glow on it are interpolated between these keyframes.

const KEYS = [
  // hour, zenith,    horizon,   glow,      glow strength
  [0,    '#070a16', '#0e1220', '#818cf8', 0.10],
  [5,    '#0b1026', '#2a2448', '#f5c26b', 0.18],
  [7,    '#1b2550', '#6b4a5e', '#f5c26b', 0.45],
  [11,   '#20306b', '#3a4e9c', '#c9d2ff', 0.25],
  [16.5, '#20306b', '#3a4e9c', '#c9d2ff', 0.25],
  [19.5, '#1a1f4a', '#6a3f58', '#f2a65a', 0.45],
  [22,   '#0a0e1e', '#141936', '#818cf8', 0.14],
  [24,   '#070a16', '#0e1220', '#818cf8', 0.10],
];

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i] - v) * t));

/** hour: 0 <= hour < 24, fractional. Returns { zenith, horizon, glow, strength }. */
export function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = KEYS.findIndex((k) => k[0] > h);
  if (i === -1) i = KEYS.length - 1;
  const a = KEYS[i - 1], b = KEYS[i];
  const t = (h - a[0]) / (b[0] - a[0]);
  return {
    zenith: mix(a[1], b[1], t),
    horizon: mix(a[2], b[2], t),
    glow: mix(a[3], b[3], t),
    strength: +(a[4] + (b[4] - a[4]) * t).toFixed(3),
  };
}

/** Which greeting fits the hour. The result is a message key. */
export function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return 'greetMorning';
  if (hour >= 12 && hour < 17) return 'greetDay';
  if (hour >= 17 && hour < 22) return 'greetEvening';
  return 'greetNight';
}
