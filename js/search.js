import { store } from './store.js';
import { fullName } from './ui.js';

export { highlight } from './ui.js';

export function searchText(p) {
  return [p.brand, p.name, p.key.chip, p.key.os, ...Object.values(p.specs).flatMap((s) => Object.values(s))].join(' ').toLowerCase();
}

// When any phone name matches, only name matches are returned; otherwise the spec sheets are searched
// (so "pixel" finds Pixels, not every phone whose resolution is listed in "pixels").
export function searchPhones(q, exclude = []) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  // A single letter only counts at the start of a word, so "galaxy a" means the A series.
  const has = (text, t) => (t.length === 1 ? new RegExp(`(^|[^a-z0-9])${t.replace(/[^a-z0-9]/g, '\\$&')}`).test(text) : text.includes(t));
  const scored = store.phones
    .filter((p) => !exclude.includes(p.id))
    .map((p) => {
      const name = `${fullName(p)} ${p.key.chip ?? ''}`.toLowerCase();
      if (terms.every((t) => has(name, t))) return { p, score: fullName(p).toLowerCase().startsWith(terms[0]) || p.name.toLowerCase().startsWith(terms[0]) ? 0 : 1 };
      const hay = searchText(p);
      return terms.every((t) => has(hay, t)) ? { p, score: 2 } : null;
    })
    .filter(Boolean);
  const pool = scored.some((x) => x.score < 2) ? scored.filter((x) => x.score < 2) : scored;
  return pool.sort((a, b) => a.score - b.score || b.p.announced.localeCompare(a.p.announced)).map((x) => x.p);
}
