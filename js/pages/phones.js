import { store, brandList, priceOf } from '../store.js';
import { app, esc, icon, phoneCard, setTitle, emptyState, fmtPKR, fmtUSD, brandLabel } from '../ui.js';
import { searchPhones } from '../search.js';

const SORTS = [
  ['newest', 'Newest first'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['battery', 'Biggest battery'],
  ['charging', 'Fastest charging'],
  ['camera', 'Highest MP camera'],
  ['weight', 'Lightest'],
];

const by = (fn, dir = -1) => (a, b) => {
  const va = fn(a), vb = fn(b);
  if (va == null) return 1;
  if (vb == null) return -1;
  return dir * (va - vb);
};
const SORTERS = {
  newest: (a, b) => b.announced.localeCompare(a.announced),
  'price-asc': by(priceOf, 1),
  'price-desc': by(priceOf, -1),
  battery: by((p) => p.key.batteryMah),
  charging: by((p) => p.key.chargingW),
  camera: by((p) => p.key.mainCamMP),
  weight: by((p) => p.key.weightG, 1),
};

const priceSteps = () => (store.currency === 'PKR' ? [50000, 80000, 120000, 200000, 300000, 450000] : [400, 600, 900, 1200, 1500]);


export function render({ params }) {
  setTitle('All phones');
  const f = {
    q: params.get('q') || '',
    brand: params.get('brand') || 'All',
    sort: SORTERS[params.get('sort')] ? params.get('sort') : 'newest',
    max: params.get('max') || '',
  };
  const brands = ['All', ...brandList().map((b) => b.name)];

  app.innerHTML = `
    <header class="page-head reveal">
      <span class="eyebrow">${icon('grid')}Catalog</span>
      <h1>All phones</h1>
      <p>Use the search bar at the top for any phone, chip or spec. Filter by brand and budget, and sort by what matters to you.</p>
    </header>
    <div id="qChip"></div>
    <div class="toolbar reveal" style="--i:2">
      <div class="chips" id="brandChips">
        ${brands.map((b) => `<button type="button" class="chip ${b === f.brand ? 'on' : ''}" data-brand="${esc(b)}">${b === 'All' ? 'All' : brandLabel(b)}</button>`).join('')}
      </div>
      <div class="toolbar-right">
        <select class="select" id="maxPrice" aria-label="Maximum price">
          <option value="">Any price</option>
          ${priceSteps().map((v) => `<option value="${v}" ${String(v) === f.max ? 'selected' : ''}>Under ${store.currency === 'PKR' ? fmtPKR(v) : fmtUSD(v)}</option>`).join('')}
        </select>
        <select class="select" id="sort" aria-label="Sort">
          ${SORTS.map(([v, l]) => `<option value="${v}" ${v === f.sort ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <p class="result-count" id="count"></p>
    <div class="grid" id="grid"></div>`;

  const syncUrl = () => {
    const qs = new URLSearchParams();
    if (f.q) qs.set('q', f.q);
    if (f.brand !== 'All') qs.set('brand', f.brand);
    if (f.sort !== 'newest') qs.set('sort', f.sort);
    if (f.max) qs.set('max', f.max);
    const next = `#/phones${qs.toString() ? '?' + qs : ''}`;
    if (location.hash !== next) history.replaceState(null, '', next);
  };

  let firstDraw = true;
  const draw = () => {
    const matches = f.q.trim() ? new Set(searchPhones(f.q.trim()).map((p) => p.id)) : null;
    const list = store.phones.filter((p) => {
      if (f.brand !== 'All' && p.brand !== f.brand) return false;
      if (f.max) {
        const v = priceOf(p);
        if (v == null || v > Number(f.max)) return false;
      }
      return !matches || matches.has(p.id);
    }).sort(SORTERS[f.sort]);

    app.querySelector('#count').textContent = `${list.length} phone${list.length === 1 ? '' : 's'}`;
    app.querySelector('#grid').innerHTML = list.length
      ? list.map((p) => phoneCard(p, { q: f.q, reveal: firstDraw })).join('')
      : emptyState('search', 'No phones match', 'Try a different search or clear the filters.', '<a class="btn" href="#/phones">Clear filters</a>');
    syncUrl();
    firstDraw = false;
  };

  // Searches come from the top bar; this chip shows the active query and clears it.
  const qChip = app.querySelector('#qChip');
  const paintQuery = () => {
    qChip.innerHTML = f.q
      ? `<div class="query-chip">Results for “<b>${esc(f.q)}</b>”<button type="button" aria-label="Clear search">${icon('x')}</button></div>`
      : '';
  };
  qChip.addEventListener('click', (e) => {
    if (!e.target.closest('button')) return;
    f.q = '';
    paintQuery();
    draw();
  });
  paintQuery();
  app.querySelector('#brandChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-brand]');
    if (!b) return;
    f.brand = b.dataset.brand;
    app.querySelectorAll('#brandChips .chip').forEach((c) => c.classList.toggle('on', c === b));
    draw();
  });
  app.querySelector('#sort').addEventListener('change', (e) => { f.sort = e.target.value; draw(); });
  app.querySelector('#maxPrice').addEventListener('change', (e) => { f.max = e.target.value; draw(); });
  draw();
}
