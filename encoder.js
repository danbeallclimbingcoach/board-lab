// Aurora LED protocol encoder (Tension Board 2), after Boardsesh's
// docs/AURORA_BLUETOOTH_PROTOCOL_SPEC.md (Apache-2.0). Pure functions, no Bluetooth.
const AURORA = (() => {
  const CMD = { 2: { single: 80, start: 78, cont: 77, end: 79 }, 3: { single: 84, start: 82, cont: 81, end: 83 } };
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));

  function checksum(payload) {
    let t = 0;
    for (const b of payload) t = (t + b) & 0xff;
    return ~t & 0xff;
  }
  function wrap(payload) {
    return [0x01, payload.length, checksum(payload), 0x02, ...payload, 0x03];
  }

  // v2 brightness budget: 18 W total, scaled down in steps until it fits.
  function v2Scale(leds) {
    for (const s of [1.0, 0.8, 0.6, 0.4, 0.2, 0.1, 0.05]) {
      let p = 0;
      for (const { color } of leds) {
        const [r, g, b] = hex(color);
        p += (Math.floor(r * s) >> 6) + (Math.floor(g * s) >> 6) + (Math.floor(b * s) >> 6);
      }
      if (p / 30 <= 18) return s;
    }
    return 0;
  }

  function ledBytes(api, led, scale) {
    const [r, g, b] = hex(led.color), pos = led.position;
    if (api >= 3) return [pos & 0xff, (pos >> 8) & 0xff, ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6)];
    const sc = (v) => Math.floor(v * scale) >> 6;
    return [pos & 0xff, (sc(r) << 6) | (sc(g) << 4) | (sc(b) << 2) | ((pos >> 8) & 0x03)];
  }

  // leds: [{position, color:"RRGGBB"}] -> byte array of one or more framed messages
  function encode(leds, api) {
    api = api >= 3 ? 3 : 2;
    const c = CMD[api], scale = api === 2 ? v2Scale(leds) : 1;
    const maxPos = api === 3 ? 65535 : 1023;
    const parts = [[c.cont]];
    for (const led of leds) {
      if (led.position < 0 || led.position > maxPos) continue;
      const bytes = ledBytes(api, led, scale);
      if (parts[parts.length - 1].length + bytes.length > 255) parts.push([c.cont]);
      parts[parts.length - 1].push(...bytes);
    }
    if (parts.length === 1) parts[0][0] = c.single;
    else { parts[0][0] = c.start; parts[parts.length - 1][0] = c.end; }
    return parts.flatMap(wrap);
  }

  // "Name#serial@3" -> 3; no @ -> 2
  function apiLevel(name) {
    const m = /@(\d+)/.exec(name || "");
    return m ? parseInt(m[1], 10) : 2;
  }

  return { encode, apiLevel, checksum, wrap };
})();
if (typeof module !== "undefined") module.exports = AURORA;
