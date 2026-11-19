// Board Lab climb search, run in the browser. The presets "Low crimp" and "Slopers & pinches"
// give the same results as tools/board_lab/find_climbs.py --mode low-crimp / sloper-pinch.
// Catalogue rows: [uuid, name, setter, frames, [[angle, difficulty, ascents, quality(1-5), benchmark], ...]]
const BLSEARCH = (() => {
  const HAND = new Set([5, 6, 7]);
  const TAGS = ["jug", "ledge", "crimp", "sloper", "pinch", "pocket"];
  // Non-strict avoid: a hold with an avoided tag is only "mixed" if it also has one of these
  // (not avoided). Pocket doesn't count: a crimpy pocket is still a crimp.
  const SOFTENERS = ["jug", "ledge", "crimp", "sloper", "pinch"];
  // What lists without their own focus (built-in lists) show
  const DEFAULT_FOCUS = { want: ["sloper", "pinch"], avoid: ["crimp"], strict: false };

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

  // p: {angle, vlo, vhi, minAscents, minStars, noClassics, top,
  //     want: [tags], avoid: [tags], strict, minShare (0-1, of hand holds with a wanted tag),
  //     maxAvoid (null = no limit), sort: best|stars|ascents,
  //     withHolds / withoutHolds: placement ids the climb must / must not use (any role)}
  function search(cat, grades, typeOf, tagsByType, p) {
    const f = { want: p.want || [], avoid: p.avoid || [], strict: !!p.strict };
    const byTags = f.want.length > 0 || f.avoid.length > 0;
    if (byTags && !tagsByType) throw new Error("Unlock your hold tags to search by hold type.");
    const withH = p.withHolds || [], withoutH = p.withoutHolds || [];
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
      if (withH.length || withoutH.length) {
        const used = new Set(frames(row[3]).map(x => x[0]));
        if (!withH.every(h => used.has(h)) || withoutH.some(h => used.has(h))) continue;
      }
      // counts for the search focus; without one, the default focus (for display only)
      const h = holdCounts(row, typeOf, tagsByType, byTags ? f : DEFAULT_FOCUS);
      if (byTags && !h.hands) continue;
      const share = byTags && f.want.length ? h.wanted / h.hands : 0;
      if (f.want.length && share < (p.minShare || 0)) continue;
      if (f.avoid.length && p.maxAvoid != null && h.avoided > p.maxAvoid) continue;
      out.push(Object.assign(c, { counts: h, share }));
    }
    out.sort(SORTS[p.sort] || SORTS.best);
    return out.slice(0, p.top);
  }

  return { search, at, frames, gradeName, holdCounts, TAGS, DEFAULT_FOCUS };
})();
if (typeof module !== "undefined") module.exports = BLSEARCH;
