// Board Lab climb search: the same rules as tools/board_lab/find_climbs.py, run in the browser.
// Catalogue rows: [uuid, name, setter, frames, [[angle, difficulty, ascents, quality(1-5), benchmark], ...]]
const BLSEARCH = (() => {
  const HAND = new Set([5, 6, 7]);
  const GENTLE = ["jug", "ledge", "sloper", "pinch"];

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

  // Hand-hold tag counts; tagsByType null -> null
  function holdCounts(row, typeOf, tagsByType) {
    if (!tagsByType) return null;
    let n = 0, pure = 0, mixed = 0, good = 0;
    for (const [pid, role] of frames(row[3])) {
      if (!HAND.has(role)) continue;
      const t = typeOf[pid]; if (!t) continue;
      const l = tagsByType[t] || [];
      n++;
      const crimp = l.includes("crimp"), gentle = GENTLE.some(k => l.includes(k));
      if (crimp && !gentle) pure++; else if (crimp) mixed++;
      if (l.includes("sloper") || l.includes("pinch")) good++;
    }
    return { hands: n, pure, mixed, good };
  }

  const r1 = (x) => Math.round(x * 10) / 10;

  // p: {angle, vlo, vhi, minAscents, minStars, noClassics, mode: any|low-crimp|sloper-pinch, minShare, top}
  function search(cat, grades, typeOf, tagsByType, p) {
    if (p.mode !== "any" && !tagsByType) throw new Error("Unlock your hold tags to search by hold type.");
    const [lo, hi] = gradeRange(grades, p.vlo, p.vhi);
    const out = [];
    for (const row of cat) {
      const c = at(row, p.angle, grades);
      if (!c || c.diff < lo || c.diff >= hi) continue;
      if (c.ascents < p.minAscents || c.stars < p.minStars) continue;
      if (p.noClassics) {
        const total = row[4].reduce((a, s) => a + s[2], 0), bm = row[4].some(s => s[4]);
        if (bm || total >= 500) continue;
      }
      const h = holdCounts(row, typeOf, tagsByType);
      if (h && !h.hands && p.mode !== "any") continue;
      const share = h && h.hands ? h.good / h.hands : 0;
      if (p.mode === "sloper-pinch" && share < p.minShare) continue;
      out.push(Object.assign(c, { counts: h, share }));
    }
    if (p.mode === "low-crimp")
      out.sort((a, b) => a.counts.pure - b.counts.pure || b.share - a.share || a.counts.mixed - b.counts.mixed || b.stars - a.stars || b.ascents - a.ascents);
    else
      out.sort((a, b) => r1(b.stars) - r1(a.stars) || b.share - a.share || b.ascents - a.ascents);
    return out.slice(0, p.top);
  }

  return { search, at, frames, gradeName, holdCounts };
})();
if (typeof module !== "undefined") module.exports = BLSEARCH;
