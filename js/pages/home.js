import { store, brandList, BUDGETS, inBudget } from '../store.js';
import { app, esc, num, icon, fmtPKR, fullName, phoneCard, sectionHead, setTitle, brandBadge, thumb, highlight } from '../ui.js';
import { carouselHTML, initCarousel } from '../carousel.js';
import { searchPhones } from '../search.js';

const QUICK = [
  ['#/prices?range=50k-100k', 'Rs 50k – 100k'],
  ['#/rankings?by=battery', 'Biggest battery'],
  ['#/rankings?by=camera', 'Best camera MP'],
  ['#/brand/Samsung', 'Samsung'],
  ['#/brand/Apple', 'iPhone'],
  ['#/compare', 'Compare phones'],
];

function leader(get) {
  return store.phones.filter((p) => get(p) != null).sort((a, b) => get(b) - get(a))[0];
}

const POPULAR_IDS = [
  ['samsung-galaxy-s26-ultra', 'apple-iphone-18-pro-max'],
  ['google-pixel-11-pro', 'apple-iphone-18-pro'],
  ['samsung-galaxy-a57-5g', 'xiaomi-redmi-note-15-pro-plus'],
  ['infinix-note-60-pro', 'tecno-camon-50-ultra'],
];
let POPULAR = [];

export function render() {
  setTitle('');
  const phones = store.phones;
  POPULAR = POPULAR_IDS.map(([a, b]) => [store.byId.get(a), store.byId.get(b)]).filter(([a, b]) => a && b);
  const inPakistan = phones.filter((p) => p.pricePKR != null).length;
  const brands = brandList();
  const leaders = [
    { by: 'battery', ic: 'battery', label: 'Biggest battery', p: leader((p) => p.key.batteryMah), v: (p) => `${num(p.key.batteryMah)} mAh` },
    { by: 'charging', ic: 'bolt', label: 'Fastest charging', p: leader((p) => p.key.chargingW), v: (p) => `${p.key.chargingW}W` },
    { by: 'camera', ic: 'camera', label: 'Highest-res camera', p: leader((p) => p.key.mainCamMP), v: (p) => `${p.key.mainCamMP}MP` },
  ].filter((l) => l.p);

  app.innerHTML = `
    ${carouselHTML()}

    <section class="home-hero">
      <span class="eyebrow reveal">Smartphones launched 2025 – 2026</span>
      <h1 class="display reveal">Find your next phone.<br><span class="dim">Verified specs.</span> <span class="grad">Real prices.</span></h1>
      <p class="lead reveal">${phones.length} current smartphones with full spec sheets, Pakistan retail prices and side-by-side comparison, plus an assistant that answers in seconds.</p>
      <div class="chips reveal">${QUICK.map(([href, label]) => `<a class="chip" href="${href}">${label}</a>`).join('')}</div>
    </section>

    <section class="stat-strip">
      ${[
        ['grid', 'Phones listed', phones.length],
        ['brands', 'Brands', brands.length],
        ['tag', 'Sold in Pakistan', inPakistan],
      ].map(([ic, k, v]) => `<div class="tile glass reveal"><div class="k">${icon(ic)}${k}</div><div class="v"${typeof v === 'number' ? ` data-count="${v}"` : ''}>${v}</div></div>`).join('')}
    </section>

    <section class="quick-compare glass reveal" id="quickCompare">
      <div class="qc-head">
        <span class="eyebrow">Compare</span>
        <h2>Compare phones side by side</h2>
        <p>Search two or three phones and see every spec next to each other.</p>
      </div>
      <div class="qc-row">
        ${[0, 1, 2].map((i) => `
          ${i ? '<span class="qc-vs" aria-hidden="true">VS</span>' : ''}
          <div class="qc-slot" data-slot="${i}">
            <div class="qc-pick">
              ${icon('search')}
              <input type="search" class="qc-input" placeholder="${i === 2 ? 'Third phone (optional)' : `Search phone ${i + 1}`}" aria-label="Phone ${i + 1}" autocomplete="off">
              <div class="qc-results" hidden></div>
            </div>
          </div>`).join('')}
        <button class="btn primary qc-go" id="qcGo" disabled>${icon('swap')}Compare</button>
      </div>
      ${POPULAR.length ? `<div class="qc-popular"><span>Popular:</span>${POPULAR.map(([a, b]) => `<a class="chip" href="#/compare?ids=${a.id},${b.id}">${esc(a.name)} vs ${esc(b.name)}</a>`).join('')}</div>` : ''}
    </section>

    <section class="section">
      ${sectionHead('Latest launches', 'The newest phones, freshest first.', '#/phones')}
      <div class="rail">${phones.slice(0, 8).map((p, i) => phoneCard(p, i)).join('')}</div>
    </section>

    <section class="section">
      ${sectionHead('Shop by budget', 'Pakistan retail prices, grouped into price ranges.', '#/prices')}
      <div class="tiles">
        ${BUDGETS.map((b, i) => {
          const list = phones.filter((p) => inBudget(p, b));
          const from = list.length ? Math.min(...list.map((p) => p.pricePKR)) : null;
          return `
            <a class="tile glass reveal" style="--i:${i}" href="#/prices?range=${b.key}">
              <div class="ico">${icon('tag')}</div>
              <div class="v">${esc(b.short)}</div>
              <div class="s">${list.length} phone${list.length === 1 ? '' : 's'}${from ? ` · from ${fmtPKR(from)}` : ''}</div>
            </a>`;
        }).join('')}
      </div>
    </section>

    <section class="section">
      ${sectionHead('Top charts', 'Ranked purely by spec sheet numbers.', '#/rankings')}
      <div class="tiles">
        ${leaders.map((l, i) => `
          <a class="tile glass reveal" style="--i:${i}" href="#/rankings?by=${l.by}">
            <div class="ico">${icon(l.ic)}</div>
            <div class="k">${l.label}</div>
            <div class="v">${esc(l.v(l.p))}</div>
            <div class="s">${esc(fullName(l.p))}</div>
          </a>`).join('')}
      </div>
    </section>

    <section class="section">
      ${sectionHead('Brands', '', '#/brands', 'All brands')}
      <div class="tiles">
        ${brands.slice(0, 10).map((b) => {
          return `
            <a class="brand-tile glass reveal" href="#/brand/${encodeURIComponent(b.name)}">
              ${brandBadge(b.name)}
              <span><b>${esc(b.name)}</b><small>${b.phones.length} phone${b.phones.length === 1 ? '' : 's'}</small></span>
            </a>`;
        }).join('')}
      </div>
    </section>

    <section class="assist-cta glass reveal">
      <div class="orb">${icon('sparkle')}</div>
      <div>
        <h2>Not sure which phone to buy?</h2>
        <p>Tell the PhoneDex Assistant your budget and what matters to you. It answers from our verified data.</p>
      </div>
      <button class="btn primary" data-open-chat data-prompt="Help me choose a phone. My budget is ">${icon('chat')}Ask the assistant</button>
    </section>`;

  countUp(app.querySelectorAll('[data-count]'));
  initQuickCompare();
  return initCarousel();
}

// Home-page compare box: each slot is a search field that turns into the chosen phone.
function initQuickCompare() {
  const root = app.querySelector('#quickCompare');
  const go = root.querySelector('#qcGo');
  const picked = [...store.compare.slice(0, 3)];
  while (picked.length < 3) picked.push(null);

  const paintSlot = (i) => {
    const slot = root.querySelector(`.qc-slot[data-slot="${i}"]`);
    const p = picked[i] && store.byId.get(picked[i]);
    slot.classList.toggle('filled', !!p);
    slot.querySelector('.qc-chosen')?.remove();
    if (p) {
      slot.insertAdjacentHTML('afterbegin', `
        <div class="qc-chosen">
          ${thumb(p, 'sm')}
          <span>${esc(fullName(p))}</span>
          <button type="button" class="qc-clear" data-clear="${i}" aria-label="Remove ${esc(fullName(p))}">${icon('x')}</button>
        </div>`);
    }
    go.disabled = picked.filter(Boolean).length < 2;
  };
  [0, 1, 2].forEach(paintSlot);

  const resultsFor = (input) => input.closest('.qc-pick').querySelector('.qc-results');
  const choose = (i, id) => {
    picked[i] = id;
    const input = root.querySelector(`.qc-slot[data-slot="${i}"] .qc-input`);
    input.value = '';
    resultsFor(input).hidden = true;
    paintSlot(i);
    const next = root.querySelector('.qc-slot:not(.filled) .qc-input');
    if (next && picked.filter(Boolean).length < 2) next.focus();
  };

  root.addEventListener('input', (e) => {
    if (!e.target.matches('.qc-input')) return;
    const box = resultsFor(e.target);
    const q = e.target.value.trim();
    if (!q) { box.hidden = true; return; }
    const list = searchPhones(q, picked.filter(Boolean)).slice(0, 6);
    box.innerHTML = list.length
      ? list.map((p) => `<button type="button" data-pick="${esc(p.id)}">${thumb(p, 'sm')}<span>${highlight(fullName(p), q)}</span></button>`).join('')
      : '<div class="cmp-none">No match</div>';
    box.hidden = false;
  });
  root.addEventListener('keydown', (e) => {
    if (!e.target.matches('.qc-input')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = resultsFor(e.target).querySelector('[data-pick]');
      if (first) choose(Number(e.target.closest('.qc-slot').dataset.slot), first.dataset.pick);
    }
    if (e.key === 'Escape') resultsFor(e.target).hidden = true;
  });
  root.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { choose(Number(pick.closest('.qc-slot').dataset.slot), pick.dataset.pick); return; }
    const clear = e.target.closest('[data-clear]');
    if (clear) { picked[Number(clear.dataset.clear)] = null; paintSlot(Number(clear.dataset.clear)); }
  });
  root.addEventListener('focusout', (e) => {
    if (e.target.matches('.qc-input') && !root.contains(e.relatedTarget)) setTimeout(() => { resultsFor(e.target).hidden = true; }, 150);
  });
  go.addEventListener('click', () => {
    const ids = picked.filter(Boolean);
    if (ids.length >= 2) location.hash = `#/compare?ids=${ids.join(',')}`;
  });
}

function countUp(els) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = performance.now();
  const ms = 1100;
  const tick = (now) => {
    const t = Math.min((now - start) / ms, 1);
    const eased = 1 - Math.pow(1 - t, 4);
    els.forEach((el) => { el.textContent = Math.round(Number(el.dataset.count) * eased); });
    if (t < 1 && els[0]?.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
