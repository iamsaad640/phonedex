import { store, MAX_COMPARE, setCompare } from '../store.js';
import { app, esc, num, icon, thumb, fullName, fmtDate, fmtPKR, fmtUSD, fmtStorage, setTitle } from '../ui.js';
import { searchPhones, highlight } from '../search.js';

const unit = (u) => (v) => (v == null ? '—' : `${typeof v === 'number' ? num(v) : v}${u}`);
// [label, value, which is better, format, optional getter used only for picking the winner]
const KEY_ROWS = [
  ['Price (Pakistan)', (p) => p.pricePKR ?? p.approx?.pkr ?? null, 'min',
    (v, p) => (v == null ? '—' : p.pricePKR != null ? fmtPKR(v) : `≈ ${fmtPKR(v)} (converted)`),
    (p) => p.pricePKR],
  ['Launch price', (p) => p.priceUSD, 'min', fmtUSD],
  ['Announced', (p) => p.announced, null, fmtDate],
  ['Display size', (p) => p.key.displayIn, null, unit('″')],
  ['Refresh rate', (p) => p.key.refreshHz, 'max', unit(' Hz')],
  ['Chipset', (p) => p.key.chip, null, (v) => v ?? '—'],
  ['Base RAM', (p) => p.key.ramGB, 'max', unit(' GB')],
  ['Base storage', (p) => p.key.storageMinGB, 'max', fmtStorage],
  ['Main camera', (p) => p.key.mainCamMP, 'max', unit(' MP')],
  ['Battery', (p) => p.key.batteryMah, 'max', unit(' mAh')],
  ['Wired charging', (p) => p.key.chargingW, 'max', unit(' W')],
  ['Weight', (p) => p.key.weightG, 'min', unit(' g')],
];

let onlyDiff = false;

function bestIndexes(vals, better) {
  const out = new Set();
  if (!better) return out;
  const nums = vals.map((v) => (typeof v === 'number' ? v : null));
  const present = nums.filter((v) => v != null);
  if (present.length < 2) return out;
  const target = better === 'max' ? Math.max(...present) : Math.min(...present);
  if (present.every((v) => v === target)) return out;
  nums.forEach((v, i) => { if (v === target) out.add(i); });
  return out;
}

let slots = [];
let wrap = null;
let outsideClickBound = false;

export function render({ params }) {
  setTitle('Compare phones');
  const fromUrl = params.get('ids');
  if (fromUrl) setCompare(fromUrl.split(','));
  slots = [...store.compare];
  while (slots.length < MAX_COMPARE) slots.push('');

  // The header is drawn once; later changes only redraw the table so nothing re-animates or jumps.
  app.innerHTML = `
    <div class="compare-head reveal">
      <div class="page-head" style="margin:0">
        <span class="eyebrow">Side by side</span>
        <h1>Compare phones</h1>
        <p>Up to ${MAX_COMPARE} phones. Type a name to add one. <b style="color:var(--good)">Green ✓</b> marks the better number; highlighted rows differ.</p>
      </div>
      <label class="toggle"><input type="checkbox" id="onlyDiff" ${onlyDiff ? 'checked' : ''}> Differences only</label>
    </div>
    <div class="cmp-scroll glass reveal" id="cmpWrap"></div>`;
  wrap = app.querySelector('#cmpWrap');
  app.querySelector('#onlyDiff').addEventListener('change', (e) => { onlyDiff = e.target.checked; draw(); });
  bindPickers();
  draw();
}

function setSlot(i, id) {
  slots[i] = id;
  setCompare(slots.filter(Boolean));
  slots = [...store.compare];
  while (slots.length < MAX_COMPARE) slots.push('');
  history.replaceState(null, '', store.compare.length ? `#/compare?ids=${store.compare.join(',')}` : '#/compare');
  draw();
}

function pickerHTML(p, i) {
  return `
    <div class="cmp-pick">
      ${icon('search')}
      <input type="search" class="cmp-input" data-slot="${i}" placeholder="${p ? 'Change' : 'Search'}"
        aria-label="Search a phone for slot ${i + 1}" autocomplete="off">
      <div class="cmp-results" hidden></div>
    </div>`;
}

function bindPickers() {
  const results = (input) => input.closest('.cmp-pick').querySelector('.cmp-results');
  const show = (input) => {
    const box = results(input);
    const q = input.value.trim();
    const list = q ? searchPhones(q, slots.filter(Boolean)).slice(0, 6) : [];
    if (!q) { box.hidden = true; return; }
    box.innerHTML = list.length
      ? list.map((p) => `<button type="button" data-pick="${esc(p.id)}">${thumb(p, 'sm')}<span>${highlight(fullName(p), q)}</span></button>`).join('')
      : '<div class="cmp-none">No match</div>';
    box.hidden = false;
  };
  wrap.addEventListener('input', (e) => { if (e.target.matches('.cmp-input')) show(e.target); });
  wrap.addEventListener('keydown', (e) => {
    if (!e.target.matches('.cmp-input')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = results(e.target).querySelector('[data-pick]');
      if (first) setSlot(Number(e.target.dataset.slot), first.dataset.pick);
    }
    if (e.key === 'Escape') { results(e.target).hidden = true; e.target.blur(); }
  });
  wrap.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { setSlot(Number(pick.closest('.cmp-pick').querySelector('.cmp-input').dataset.slot), pick.dataset.pick); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) setSlot(Number(rm.dataset.remove), '');
  });
  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', (e) => {
      if (!wrap?.isConnected) return;
      wrap.querySelectorAll('.cmp-results').forEach((box) => { if (!box.parentElement.contains(e.target)) box.hidden = true; });
    });
  }
}

function draw() {
  const phones = slots.map((id) => store.byId.get(id) || null);
  const picked = phones.filter(Boolean);
  const cols = MAX_COMPARE + 1;

  const head = `
    <thead><tr><th></th>${phones.map((p, i) => `
      <th><div class="cmp-slot">
        ${p
          ? `<div class="media">
               <a href="#/phone/${esc(p.id)}" tabindex="-1" aria-hidden="true">${thumb(p, 'md', { eager: true })}</a>
               <button type="button" class="cmp-remove" data-remove="${i}" aria-label="Remove ${esc(fullName(p))}">${icon('x')}</button>
             </div>
             <a class="name" href="#/phone/${esc(p.id)}">${esc(fullName(p))}</a>`
          : `<div class="media empty-slot">${icon('swap')}<span>Add a phone</span></div>`}
        ${pickerHTML(p, i)}
      </div></th>`).join('')}</tr></thead>`;

  let body = '';
  if (picked.length >= 2) {
    body += `<tr class="section"><th colspan="${cols}">Key specs</th></tr>`;
    for (const [label, get, better, fmt, rankBy = get] of KEY_ROWS) {
      const vals = phones.map((p) => (p ? get(p) : undefined));
      const best = bestIndexes(phones.map((p) => (p ? rankBy(p) : undefined)), better);
      const differs = new Set(vals.filter((v) => v !== undefined).map(String)).size > 1;
      if (onlyDiff && !differs) continue;
      body += `<tr class="${differs ? 'diff' : ''}"><th scope="row">${label}</th>${vals.map((v, i) =>
        `<td class="${best.has(i) ? 'best' : ''}">${v === undefined ? '' : esc(fmt(v, phones[i]))}</td>`).join('')}</tr>`;
    }
    const sections = [...new Set(picked.flatMap((p) => Object.keys(p.specs)))];
    for (const section of sections) {
      const keys = [...new Set(picked.flatMap((p) => Object.keys(p.specs[section] || {})))];
      let rows = '';
      for (const key of keys) {
        const vals = phones.map((p) => (p ? p.specs[section]?.[key] ?? '—' : undefined));
        const differs = new Set(vals.filter((v) => v !== undefined)).size > 1;
        if (onlyDiff && !differs) continue;
        rows += `<tr class="${differs ? 'diff' : ''}"><th scope="row">${esc(key)}</th>${vals.map((v) => `<td>${v === undefined ? '' : esc(v)}</td>`).join('')}</tr>`;
      }
      if (rows) body += `<tr class="section"><th colspan="${cols}">${esc(section)}</th></tr>${rows}`;
    }
  } else {
    body = `<tr><td colspan="${cols}"><div class="empty"><div class="ico">${icon('swap')}</div><h3>Pick at least two phones</h3><p>Type a phone name in the search boxes above, or tap “Compare” on any phone card.</p></div></td></tr>`;
  }

  wrap.innerHTML = `
    <table class="cmp">
      <colgroup><col class="label-col">${phones.map(() => '<col>').join('')}</colgroup>
      ${head}
      <tbody>${body}</tbody>
    </table>`;
}
