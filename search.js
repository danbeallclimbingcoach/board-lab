// Board Lab climb search, run in the browser. The presets "Low crimp" and "Slopers & pinches"
// give the same results as tools/board_lab/find_climbs.py --mode low-crimp / sloper-pinch.
// Catalogue rows: [uuid, name, setter, frames, [[angle, difficulty, ascents, quality(1-5), benchmark], ...]]
const BLSEARCH = (() => {
  const HAND = new Set([5, 6, 7]);
  // Hold-type chips. "pocket" isn't offered (Dan, 2026-11-22): the one pocket hold is also tagged
  // crimp, so it counts as a crimp.
  const TAGS = ["jug", "ledge", "crimp", "sloper", "pinch"];
  // Non-strict avoid: a hold with an avoided tag is only "mixed" if it also has one of these
  // (not avoided).
  const SOFTENERS = ["jug", "ledge", "crimp", "sloper", "pinch"];
  // What lists without their own focus (built-in lists) show
  const DEFAULT_FOCUS = { want: ["sloper", "pinch"], avoid: ["crimp"], strict: false };

  // Pull-direction names (layer 1: the hold on the wall, either hand). deg = pull direction,
  // clockwise from up the wall (0 = undercling, 180 = down pull). Classes by angle from straight
  // down: 0-22.5 down pull, 45 diagonal down, 67.5-112.5 sideways (one hand's side pull is the
  // other's gaston), 135 diagonal undercling, 157.5-180 undercling.
  const ORIENTS = ["down", "diag-down", "side", "diag-up", "under"];
  const ORIENT_NAME = {down: "down pull", "diag-down": "diagonal down", side: "side pull / gaston",
                       "diag-up": "diagonal undercling", under: "undercling"};
  function orientOf(deg) {
    const off = Math.abs(((deg - 180) % 360 + 540) % 360 - 180);    // 0..180 from straight down
    return off <= 22.6 ? "down" : off <= 45.1 ? "diag-down" : off <= 112.6 ? "side" : off <= 135.1 ? "diag-up" : "under";
  }
  // Per climb: how many hand holds offer each class, and how many offer only that class.
  // pulls: {placement: [[deg, wallFixed 0/1], ...]} (Dan's tags; null while locked)
  function orientCounts(row, pulls) {
    if (!pulls) return null;
    const c = {hands: 0, has: {}, only: {}};
    for (const k of ORIENTS) { c.has[k] = 0; c.only[k] = 0; }
    for (const [pid, role] of frames(row[3])) {
      if (!HAND.has(role) || !pulls[pid]) continue;
      const cls = new Set(pulls[pid].map(a => orientOf(a[0])));
      c.hands++;
      for (const k of cls) c.has[k]++;
      if (cls.size === 1) c.only[[...cls][0]]++;
    }
    return c;
  }
  // want: every wanted class offered by at least one hand hold; avoid: no hand hold whose
  // directions are all avoided (a hold that also offers another direction doesn't count)
  function orientOk(row, pulls, p) {
    const want = p.orientWant || [], avoid = p.orientAvoid || [];
    if (!want.length && !avoid.length) return true;
    if (!pulls) throw new Error("Unlock your hold tags to search by pull direction.");
    const seen = new Set();
    for (const [pid, role] of frames(row[3])) {
      if (!HAND.has(role) || !pulls[pid]) continue;
      const cls = pulls[pid].map(a => orientOf(a[0]));
      cls.forEach(k => seen.add(k));
      if (avoid.length && cls.every(k => avoid.includes(k))) return false;
    }
    return want.every(k => seen.has(k));
  }

  function frames(fr) { return [...(fr || "").matchAll(/p(\d+)r(\d+)/g)].map(m => [m[1], +m[2]]); }

  function gradeRange(grades, vlo, vhi) {
    const n = (v) => +v.slice(1), lo = n(vlo), hi = n(vhi);
    const ds = Object.entries(grades).filter(([, g]) => n(g[0]) >= lo && n(g[0]) <= hi).map(([d]) => +d);
    return [Math.min(...ds) - 0.5, Math.max(...ds) + 0.5];
  }

  function gradeName(grades, diff) {
    const g = grades[String(Math.round(diff))];
    return g ? `${g[0]} (${g[1]})` : `~${diff.toFixed(1)}`;
  }

  // One climb as shown in a list, at one angle
  function at(row, angle, grades) {
    const s = row[4].find(x => x[0] === angle);
    if (!s) return null;
    return { uuid: row[0], name: row[1], setter: row[2], frames: row[3], diff: s[1], grade: gradeName(grades, s[1]),
             ascents: s[2], stars: s[3] * 3 / 5, benchmark: !!s[4] };
  }

  // Hand-hold counts for a focus {want, avoid, strict}; tagsByType null -> null.
  // wanted: holds with any wanted tag. avoided: holds with an avoided tag (non-strict: and no
  // other softening tag). mixed: avoided-tag holds that do have one (always 0 when strict).
  function holdCounts(row, typeOf, tagsByType, focus) {
    if (!tagsByType) return null;
    const f = focus || DEFAULT_FOCUS;
    let hands = 0, wanted = 0, avoided = 0, mixed = 0;
    for (const [pid, role] of frames(row[3])) {
      if (!HAND.has(role)) continue;
      const t = typeOf[pid]; if (!t) continue;
      const l = tagsByType[t] || [];
      hands++;
      if (f.want.some(k => l.includes(k))) wanted++;
      if (f.avoid.some(k => l.includes(k))) {
        const softened = !f.strict && l.some(k => SOFTENERS.includes(k) && !f.avoid.includes(k));
        if (softened) mixed++; else avoided++;
      }
    }
    return { hands, wanted, avoided, mixed };
  }

  const r1 = (x) => Math.round(x * 10) / 10;
  const NONE = { hands: 0, wanted: 0, avoided: 0, mixed: 0 };
  const k = (c) => c.counts || NONE;          // counts are null while tags are locked
  const SORTS = {
    // fewest avoided, most wanted, fewest mixed, then stars and ascents
    best: (a, b) => k(a).avoided - k(b).avoided || b.share - a.share || k(a).mixed - k(b).mixed
                    || b.stars - a.stars || b.ascents - a.ascents,
    stars: (a, b) => r1(b.stars) - r1(a.stars) || b.share - a.share || k(a).avoided - k(b).avoided || b.ascents - a.ascents,
    ascents: (a, b) => b.ascents - a.ascents || b.stars - a.stars,
  };

  // Shuffle: a random pick from everything that passes, better-rated climbs a little more likely
  // (weighted sampling without replacement, weight = stars squared).
  function shuffle(list, n, rand) {
    const r = rand || Math.random;
    return list.map(c => [Math.pow(r(), 1 / Math.max(0.05, c.stars * c.stars)), c])
               .sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
  }

  // Grade / ascents / stars / classics / setter / matching / excluded: the filters every view shares
  function base(row, grades, p, range) {
    const c = at(row, p.angle, grades);
    if (!c || c.diff < range[0] || c.diff >= range[1]) return null;
    if (c.ascents < (p.minAscents || 0) || c.stars < (p.minStars || 0)) return null;
    if (p.noClassics) {
      const total = row[4].reduce((a, s) => a + s[2], 0), bm = row[4].some(s => s[4]);
      if (bm || total >= 500) return null;
    }
    if (p.setter && row[2].toLowerCase() !== p.setter.toLowerCase()) return null;
    if (p.match === "nomatch" && !row[5]) return null;
    if (p.match === "match" && row[5]) return null;
    if (p.exclude && p.exclude.has(row[0])) return null;
    c.noMatch = !!row[5];
    return c;
  }

  // Hold picks: each item is {pid} (that spot) or {type} (any placement of that hold type).
  // Only hand holds (start, hand, finish) count: a foot on a picked hold neither uses nor breaks it.
  function picksOk(row, typeOf, p) {
    const use = p.mustUse || [], avoid = p.mustAvoid || [];
    if (!use.length && !avoid.length) return true;
    const pids = new Set(frames(row[3]).filter(x => HAND.has(x[1])).map(x => x[0])), types = new Set([...pids].map(pid => typeOf[pid]));
    const hit = (it) => it.pid ? pids.has(it.pid) : types.has(it.type);
    if (avoid.some(hit)) return false;
    if (!use.length) return true;
    return p.useMode === "any" ? use.some(hit) : use.every(hit);
  }

  // p: {angle, vlo, vhi, minAscents, minStars, noClassics, top, setter, match: any|nomatch|match,
  //     exclude: Set of uuids, want: [tags], avoid: [tags], strict, minShare (0-1, of hand holds
  //     with a wanted tag), maxAvoid (null = no limit), sort: best|stars|ascents|shuffle,
  //     mustUse / mustAvoid: [{pid} | {type}], useMode: all|any,
  //     pulls: {placement: [[deg, wall], ...]} | null, orientWant / orientAvoid: [classes]}
  function search(cat, grades, typeOf, tagsByType, p) {
    const f = { want: p.want || [], avoid: p.avoid || [], strict: !!p.strict };
    const byTags = f.want.length > 0 || f.avoid.length > 0;
    if (byTags && !tagsByType) throw new Error("Unlock your hold tags to search by hold type.");
    const range = gradeRange(grades, p.vlo, p.vhi);
    const out = [];
    for (const row of cat) {
      const c = base(row, grades, p, range);
      if (!c || !picksOk(row, typeOf, p) || !orientOk(row, p.pulls, p)) continue;
      // counts for the search focus; without one, the default focus (for display only)
      const h = holdCounts(row, typeOf, tagsByType, byTags ? f : DEFAULT_FOCUS);
      if (byTags && !h.hands) continue;
      const share = byTags && f.want.length ? h.wanted / h.hands : 0;
      if (f.want.length && share < (p.minShare || 0)) continue;
      if (f.avoid.length && p.maxAvoid != null && h.avoided > p.maxAvoid) continue;
      out.push(Object.assign(c, { counts: h, share, orient: orientCounts(row, p.pulls) }));
    }
    if (p.sort === "shuffle") return shuffle(out, p.top, p.rand);
    out.sort(SORTS[p.sort] || SORTS.best);
    return out.slice(0, p.top);
  }

  // Climbs like `row` at angle p.angle within p's grade range, hand holds (start/hand/finish) only:
  // 60% position (for each hand hold, how close the other climb's nearest hand hold is, both ways;
  // a hold one grid step away (4 units, ~10 cm) still scores 0.6) + 40% shared hold types
  // (multiset Jaccard). Other filters as in search, except hold tags. pos: placement -> [x, y].
  function similar(cat, grades, typeOf, pos, row, p) {
    const hands = (r) => frames(r[3]).filter(([pid, role]) => HAND.has(role) && pos[pid]).map(([pid]) => pid);
    const typeBag = (pids) => { const m = {}; for (const pid of pids) { const t = typeOf[pid]; if (t) m[t] = (m[t] || 0) + 1; } return m; };
    const near = (from, to) => from.reduce((acc, a) => {
      let d2 = Infinity; for (const b of to) { const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1]; d2 = Math.min(d2, dx * dx + dy * dy); }
      return acc + Math.exp(-d2 / 32);       // exp(-(4^2)/32) = 0.61
    }, 0) / from.length;
    const A = hands(row), TA = typeBag(A), SA = new Set(A), range = gradeRange(grades, p.vlo, p.vhi);
    if (!A.length) return [];
    const out = [];
    for (const r of cat) {
      if (r[0] === row[0]) continue;
      const c = base(r, grades, p, range);
      if (!c) continue;
      const B = hands(r); if (!B.length) continue;
      const TB = typeBag(B); let tmin = 0, tmax = 0;
      for (const t of new Set([...Object.keys(TA), ...Object.keys(TB)])) { tmin += Math.min(TA[t] || 0, TB[t] || 0); tmax += Math.max(TA[t] || 0, TB[t] || 0); }
      c.similarity = 0.6 * (near(A, B) + near(B, A)) / 2 + 0.4 * (tmax ? tmin / tmax : 0);
      c.shared = B.filter(x => SA.has(x)).length;
      out.push(c);
    }
    out.sort((a, b) => b.similarity - a.similarity || b.stars - a.stars);
    return out.slice(0, p.top);
  }

  // Setters over the climbs that pass the shared filters (no hold filters):
  // climbs, total ascents, rating = ascent-weighted mean stars. by: rating|repeats|climbs.
  function setters(cat, grades, p, by, minClimbs) {
    const range = gradeRange(grades, p.vlo, p.vhi), m = new Map();
    for (const row of cat) {
      const c = base(row, grades, Object.assign({}, p, { setter: "" }), range);
      if (!c || !c.setter) continue;
      const s = m.get(c.setter) || { setter: c.setter, climbs: 0, ascents: 0, starSum: 0 };
      s.climbs++; s.ascents += c.ascents; s.starSum += c.stars * c.ascents;
      m.set(c.setter, s);
    }
    let out = [...m.values()].map(s => Object.assign(s, { rating: s.ascents ? s.starSum / s.ascents : 0 }));
    if (by === "rating") out = out.filter(s => s.climbs >= (minClimbs || 5));
    const key = { rating: s => s.rating, repeats: s => s.ascents, climbs: s => s.climbs }[by] || (s => s.rating);
    return out.sort((a, b) => key(b) - key(a) || b.ascents - a.ascents);
  }

  return { search, similar, setters, shuffle, at, frames, gradeName, holdCounts, TAGS, DEFAULT_FOCUS,
           ORIENTS, ORIENT_NAME, orientOf, orientCounts, orientOk };
})();
if (typeof module !== "undefined") module.exports = BLSEARCH;
