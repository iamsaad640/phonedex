import { store, loadData, subscribe, toggleCompare, toggleLike, setCurrency, isComparing, isLiked } from './store.js';
import { app, esc, icon, fullName, fmtDate, toast, compareBtnLabel, thumb, priceInfo } from './ui.js';
import { searchPhones, highlight } from './search.js';
import { initChat, openChat } from './chat.js';
import * as home from './pages/home.js';
import * as phones from './pages/phones.js';
import * as phone from './pages/phone.js';
import * as compare from './pages/compare.js';
import * as rankings from './pages/rankings.js';
import * as prices from './pages/prices.js';
import * as liked from './pages/liked.js';
import * as support from './pages/support.js';
import { renderBrands, renderBrand } from './pages/brands.js';
import * as founder from './pages/founder.js';

const ROUTES = {
  '': home.render,
  phones: phones.render,
  phone: phone.render,
  compare: compare.render,
  brands: renderBrands,
  brand: renderBrand,
  rankings: rankings.render,
  prices: prices.render,
  liked: liked.render,
  support: support.render,
  founder: founder.render,
};
const SECTION_OF = { phone: 'phones', brand: 'brands', '': 'home' };

const NAV = [
  ['home', '#/', 'Home', 'home'],
  ['phones', '#/phones', 'Phones', 'grid'],
  ['brands', '#/brands', 'Brands', 'brands'],
  ['rankings', '#/rankings', 'Top charts', 'chart'],
  ['prices', '#/prices', 'Prices', 'tag'],
  ['compare', '#/compare', 'Compare', 'swap'],
  ['support', '#/support', 'Support', 'help'],
  ['founder', '#/founder', 'Founder', 'user'],
];
const DOCK = [
  ['home', '#/', 'Home', 'home'],
  ['phones', '#/phones', 'Phones', 'grid'],
  ['brands', '#/brands', 'Brands', 'brands'],
  ['compare', '#/compare', 'Compare', 'swap'],
  ['founder', '#/founder', 'Founder', 'user'],
];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let cleanup = null;

function parseHash() {
  const [path, qs] = location.hash.slice(1).split('?');
  const parts = (path || '/').split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(qs || ''), key: parts[0] || '' };
}

function route({ animate = true } = {}) {
  const r = parseHash();
  const render = ROUTES[r.key] || ROUTES[''];
  const run = () => {
    cleanup?.();
    cleanup = null;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const out = render(r);
    if (typeof out === 'function') cleanup = out;
    setActive(SECTION_OF[r.key] ?? r.key);
    renderCompareBar();
  };
  if (animate && document.startViewTransition && !reducedMotion.matches) {
    const vt = document.startViewTransition(run);
    vt.finished.finally(() => {
      document.querySelectorAll('[style*="view-transition-name"]').forEach((el) => { el.style.viewTransitionName = ''; });
    });
  } else run();
}

/* ---------- scroll reveal ---------- */
// Elements with .reveal fade up as they enter the viewport. Each batch that appears together is staggered.
const revealIO = 'IntersectionObserver' in window && !reducedMotion.matches
  ? new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.style.setProperty('--d', `${Math.min(n++, 8) * 55}ms`);
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' })
  : null;

function watchReveals(root) {
  const els = root.matches?.('.reveal:not(.in)') ? [root] : [];
  els.push(...(root.querySelectorAll?.('.reveal:not(.in)') ?? []));
  for (const el of els) {
    if (revealIO) revealIO.observe(el);
    else el.classList.add('in');
  }
}
new MutationObserver((records) => {
  for (const r of records) for (const node of r.addedNodes) if (node.nodeType === 1) watchReveals(node);
}).observe(app, { childList: true, subtree: true });

// Clicking a phone card morphs its picture into the hero image of the phone page.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/phone/"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || !document.startViewTransition) return;
  const img = (a.closest('.card, .chat-card, .slide, .similar a, .rank-row') || a).querySelector('.pimg img');
  if (!img) return;
  document.querySelectorAll('img[style*="view-transition-name"]').forEach((el) => { el.style.viewTransitionName = ''; });
  img.style.viewTransitionName = 'phone-hero';
}, true);

function setActive(section) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === section;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function renderShell() {
  const link = ([key, href, label, ic]) => `<a href="${href}" data-nav="${key}">${icon(ic)}<span>${label}</span></a>`;
  document.getElementById('nav').innerHTML = NAV.map(link).join('');
  document.getElementById('dock').innerHTML = DOCK.map(link).join('');
  updateLikedCount();
  syncCurrency();
}

function updateLikedCount() {
  const n = store.liked.length;
  document.getElementById('likedLink').innerHTML = `${icon('heart')}${n ? `<span class="count">${n}</span>` : ''}`;
}

function syncCurrency() {
  document.querySelectorAll('[data-currency]').forEach((b) => b.classList.toggle('on', b.dataset.currency === store.currency));
}

function renderCompareBar() {
  const bar = document.getElementById('compareBar');
  const items = store.compare.map((id) => store.byId.get(id)).filter(Boolean);
  if (!items.length || location.hash.startsWith('#/compare')) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `
    <div class="items">${items.map((p) => `<span class="pill">${esc(fullName(p))}<button data-compare="${esc(p.id)}" aria-label="Remove ${esc(fullName(p))}">${icon('x')}</button></span>`).join('')}</div>
    <a class="btn primary btn-sm" href="#/compare?ids=${items.map((p) => p.id).join(',')}">${icon('swap')}Compare ${items.length}</a>`;
}

subscribe((kind, payload) => {
  if (kind === 'compare') {
    document.querySelectorAll('.btn[data-compare]').forEach((b) => {
      const on = isComparing(b.dataset.compare);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = compareBtnLabel(on);
    });
    renderCompareBar();
    if (payload.id) {
      const p = store.byId.get(payload.id);
      const dropped = payload.dropped && store.byId.get(payload.dropped);
      if (payload.on) toast(dropped ? `Swapped ${fullName(dropped)} for ${fullName(p)}` : `${fullName(p)} added to compare`, 'swap');
      else toast(`${fullName(p)} removed from compare`, 'x');
    }
  }
  if (kind === 'liked') {
    document.querySelectorAll(`[data-like="${CSS.escape(payload.id)}"]`).forEach((b) => {
      const on = isLiked(payload.id);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
    });
    updateLikedCount();
    toast(payload.on ? 'Saved to your liked phones' : 'Removed from liked phones', 'heart');
    if (parseHash().key === 'liked') route({ animate: false });
  }
  if (kind === 'currency') {
    syncCurrency();
    route({ animate: false });
  }
});

document.addEventListener('click', (e) => {
  const cmp = e.target.closest('[data-compare]');
  if (cmp) { e.preventDefault(); toggleCompare(cmp.dataset.compare); return; }
  const like = e.target.closest('[data-like]');
  if (like) { e.preventDefault(); toggleLike(like.dataset.like); return; }
  const cur = e.target.closest('[data-currency]');
  if (cur) { if (cur.dataset.currency !== store.currency) setCurrency(cur.dataset.currency); return; }
  const chat = e.target.closest('[data-open-chat]');
  if (chat) { e.preventDefault(); openChat(chat.dataset.prompt); }
});

// Pointer-following light on glass cards.
document.addEventListener('pointermove', (e) => {
  const card = e.target.closest?.('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

/* ---------- global search (top bar) ---------- */
function initTopSearch() {
  const form = document.getElementById('topSearch');
  const input = document.getElementById('topSearchInput');
  const box = document.getElementById('topSuggest');
  let results = [];
  let active = -1;

  const close = () => { box.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
  const paintActive = () => box.querySelectorAll('[role="option"]').forEach((el, i) => el.setAttribute('aria-selected', String(i === active)));
  const render = () => {
    const q = input.value.trim();
    if (!q) { close(); return; }
    results = searchPhones(q);
    const shown = results.slice(0, 6);
    box.innerHTML = shown.length
      ? shown.map((p) => `
          <a role="option" href="#/phone/${esc(p.id)}" aria-selected="false">
            ${thumb(p, 'sm')}
            <span class="ts-name">${highlight(fullName(p), q)}<small>${highlight(p.key.chip ?? '', q)}</small></span>
            <span class="ts-price">${priceInfo(p).value}</span>
          </a>`).join('') + (results.length > 6 ? `<a class="ts-all" href="#/phones?q=${encodeURIComponent(q)}">See all ${results.length} results ${icon('arrowR')}</a>` : '')
      : `<div class="ts-empty">No phones match “${esc(q)}”</div>`;
    active = -1;
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', (e) => {
    const opts = box.querySelectorAll('[role="option"]');
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); active = (active + 1) % opts.length; paintActive(); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); active = (active - 1 + opts.length) % opts.length; paintActive(); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    const opts = box.querySelectorAll('[role="option"]');
    if (active >= 0 && opts[active]) location.hash = opts[active].getAttribute('href');
    else if (results.length === 1 && q) location.hash = `#/phone/${results[0].id}`;
    else location.hash = q ? `#/phones?q=${encodeURIComponent(q)}` : '#/phones';
    close();
    input.blur();
  });
  box.addEventListener('click', (e) => { if (e.target.closest('a')) { close(); input.value = ''; } });
  document.addEventListener('click', (e) => { if (!form.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); input.focus(); }
  });
}

// Shrinks the top search once the page is scrolled; the gap between thresholds prevents flicker.
function initCompactHeader() {
  const bar = document.getElementById('topbar');
  let compact = false;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (!compact && y > 80) { compact = true; bar.classList.add('compact'); }
    else if (compact && y < 40) { compact = false; bar.classList.remove('compact'); }
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

async function boot() {
  try {
    await loadData();
  } catch (err) {
    app.innerHTML = `<div class="empty glass" style="margin-top:40px"><h3>Couldn't load phone data</h3><p>${esc(err.message)}. Start the site with <code>npm start</code> and open the address it prints.</p></div>`;
    return;
  }
  renderShell();
  document.getElementById('dataStamp').textContent = `Data last checked ${fmtDate(store.updated)}`;
  initChat();
  initTopSearch();
  initCompactHeader();
  window.addEventListener('hashchange', () => route());
  route({ animate: false });
}

boot();
