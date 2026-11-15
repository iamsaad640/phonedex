import { store, isComparing, isLiked } from './store.js';

export const app = document.getElementById('app');

export const BRAND_COLORS = {
  Apple: ['#4a5060', '#11131a'],
  Samsung: ['#2a6cf0', '#0b2b70'],
  Google: ['#34a853', '#1a73e8'],
  Xiaomi: ['#ff7a1a', '#c13f00'],
  OnePlus: ['#f0193f', '#7a0016'],
  vivo: ['#4f6bff', '#1b2a9a'],
  OPPO: ['#20a96b', '#0b4a2f'],
  Honor: ['#16b6f0', '#004d8c'],
  Nothing: ['#5a5a5a', '#111'],
  Motorola: ['#7040b0', '#2a0f4d'],
  Tecno: ['#1a86e0', '#002c5a'],
  Infinix: ['#12cf7a', '#00602f'],
  realme: ['#f5c400', '#8a6a00'],
  Huawei: ['#e8202a', '#6d0a10'],
};
export const brandColors = (brand) => BRAND_COLORS[brand] || ['#7a8194', '#333a4a'];

// Logo files in img/brands, drawn as a CSS mask so they take the surrounding text colour.
const LOGOS = {
  Apple: 'apple.svg', Samsung: 'samsung.svg', Google: 'google.svg', Xiaomi: 'xiaomi.svg', OnePlus: 'oneplus.svg',
  vivo: 'vivo.svg', OPPO: 'oppo.svg', Honor: 'honor.svg', Huawei: 'huawei.svg', Motorola: 'motorola.svg',
  Nothing: 'nothing.png', Tecno: 'tecno.svg', Infinix: 'infinix.svg', realme: 'realme.svg',
};
const WORDMARKS = new Set(['Nothing', 'Tecno', 'Infinix', 'Samsung', 'OPPO', 'vivo', 'Honor', 'realme']);
// Brand colours, brightened where the official shade would vanish on the dark background.
const LOGO_COLORS = {
  Apple: '#f5f5f7',
  Samsung: '#5b83ff',
  Google: 'conic-gradient(from -45deg, #ea4335 0 25%, #4285f4 0 50%, #34a853 0 75%, #fbbc05 0)',
  Xiaomi: '#ff6900',
  OnePlus: '#ff2d3c',
  vivo: '#5f7cff',
  OPPO: '#2fbf71',
  Honor: '#3fb2f5',
  Huawei: '#ff3040',
  Motorola: '#5aa0ff',
  Nothing: '#f5f5f7',
  Tecno: '#2f86ff',
  Infinix: '#2fd47a',
  realme: '#ffc915',
};
export const hasLogo = (brand) => brand in LOGOS;
// Absolute so the url() inside the CSS variable resolves the same everywhere, including under a sub-path like GitHub Pages.
const LOGO_BASE = new URL('img/brands/', document.baseURI).href;
export function brandMark(brand, cls = '') {
  const file = LOGOS[brand];
  if (!file) return '';
  const color = LOGO_COLORS[brand] ? `;--logo-color:${LOGO_COLORS[brand]}` : '';
  return `<span class="bmark ${WORDMARKS.has(brand) ? 'wide' : ''} ${cls}" style="--logo:url('${LOGO_BASE}${file}')${color}" aria-hidden="true"></span>`;
}
// Logo + name; for wordmark logos the logo already spells the name, so the text is kept for screen readers only.
export function brandLabel(brand) {
  if (WORDMARKS.has(brand)) return `${brandMark(brand)}<span class="sr-only">${esc(brand)}</span>`;
  if (!hasLogo(brand)) return `<span class="brand-word" style="--logo-color:${LOGO_COLORS[brand] || 'currentColor'}">${esc(brand)}</span>`;
  return `${brandMark(brand)}${esc(brand)}`;
}
// Square badge used on brand tiles: the logo when we have one, otherwise the brand name set as a wordmark.
export function brandBadge(brand, style = '') {
  const [c1, c2] = brandColors(brand);
  const inner = hasLogo(brand) ? brandMark(brand) : `<span class="bmark-text">${esc(brand)}</span>`;
  return `<span class="brand-logo" style="--c1:${c1};--c2:${c2};${style}">${inner}</span>`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fullName = (p) => `${p.brand} ${p.name}`;

// Wraps every searched word found in `text` in <mark>; the rest is escaped.
export function highlight(text, q = '') {
  const terms = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!terms.length) return esc(text);
  // Single characters only match as whole words, so "8" doesn't light up inside "18".
  const pattern = (t) => {
    const s = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.length === 1 ? `(?<![a-z0-9])${s}(?![a-z0-9])` : s;
  };
  const re = new RegExp(`(${terms.map(pattern).join('|')})`, 'gi');
  return String(text).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
}
export const num = (n) => Number(n).toLocaleString('en-US');
export const fmtUSD = (n) => (n == null ? '—' : `$${num(n)}`);
export const fmtPKR = (n) => (n == null ? '—' : `Rs ${num(n)}`);
export const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtStorage = (gb) => (gb == null ? '—' : gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`);

export function setTitle(t) {
  document.title = t ? `${t} | PhoneDex` : 'PhoneDex — Phone Specs, Prices & Comparisons';
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  swap: 'M7 7h13l-4-4M17 17H4l4 4',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.3 8.3 3.2 5 6.5 5c2 0 3.5 1.2 5.5 3.2C14 6.2 15.5 5 17.5 5c3.3 0 5.2 3.3 3.7 6.4C19 15.6 12 20 12 20z',
  chat: 'M4 5h16v11H9l-5 4z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  brands: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 10h.01M15 10h.01',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  x: 'M6 6l12 12M18 6 6 18',
  send: 'M5 12h14M13 6l6 6-6 6',
  sparkle: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  battery: 'M3 8h15v8H3zM21 11v2M6 11v2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  display: 'M7 2h10v20H7zM11 18h2',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  weight: 'M6 9h12l2 11H4zM9 9a3 3 0 0 1 6 0',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevD: 'M6 9l6 6 6-6',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4',
  external: 'M14 4h6v6M10 14 20 4M18 14v6H4V6h6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};
export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}

// Product render when we have one, otherwise a brand-coloured mock-up.
export function thumb(p, size = '', { alt = '', eager = false, name = '' } = {}) {
  if (p.image) {
    const vt = name ? ` style="view-transition-name:${name}"` : '';
    return `<span class="pimg ${size}"><img src="${esc(p.image)}" alt="${esc(alt)}"${vt} loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false"></span>`;
  }
  const [c1, c2] = brandColors(p.brand);
  return `<span class="thumb ${size}" style="--c1:${c1};--c2:${c2}" aria-hidden="true">${esc(p.brand[0])}</span>`;
}

const DAY = 86400000;
export const isNew = (p) => store.updated && (new Date(store.updated) - new Date(p.announced)) / DAY <= 75;

// Every phone gets a price: the real one when we have it, otherwise a clearly marked conversion.
export function priceInfo(p, currency = store.currency) {
  if (currency === 'PKR') {
    if (p.pricePKR != null) return { value: fmtPKR(p.pricePKR), note: 'Pakistan retail', approx: false };
    if (p.approx) return { value: `≈ ${fmtPKR(p.approx.pkr)}`, note: `Converted from ${p.approx.from}`, approx: true };
  } else {
    if (p.priceUSD != null) return { value: fmtUSD(p.priceUSD), note: 'Launch price', approx: false };
    if (p.approx) return { value: `≈ ${fmtUSD(p.approx.usd)}`, note: `Converted from ${p.approx.from}`, approx: true };
    if (p.pricePKR != null && store.fx) return { value: `≈ ${fmtUSD(Math.round(p.pricePKR / store.fx.pkrPer.USD))}`, note: 'Converted from PKR price', approx: true };
  }
  return { value: 'Price TBA', note: 'Not announced yet', approx: true };
}
export function cardPrice(p) {
  const { value, note, approx } = priceInfo(p);
  return `<span class="${approx ? 'approx' : ''}">${value}</span><small>${esc(note)}</small>`;
}

export function compareBtn(p, extra = '') {
  const on = isComparing(p.id);
  return `<button class="btn btn-sm ${on ? 'on' : ''} ${extra}" data-compare="${esc(p.id)}" aria-pressed="${on}">${compareBtnLabel(on)}</button>`;
}
export const compareBtnLabel = (on) => (on ? `${icon('check')}Comparing` : `${icon('swap')}Compare`);

export function likeBtn(p, cls = '') {
  const on = isLiked(p.id);
  return `<button class="like-btn ${on ? 'on' : ''} ${cls}" data-like="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? 'Unlike' : 'Like'} ${esc(fullName(p))}">${icon('heart')}</button>`;
}

export function statusBadge(p) {
  return p.status === 'Available' ? '<span class="badge good">Available</span>' : `<span class="badge warn">${esc(p.status)}</span>`;
}
export function verifiedBadge(p) {
  return p.verified === 'official'
    ? `<span class="badge good" title="Checked against the manufacturer spec sheet">${icon('shield')}Official specs</span>`
    : '<span class="badge neutral" title="From an established third-party spec database">Spec database</span>';
}

export function phoneCard(p, opts = {}) {
  const q = typeof opts === 'object' ? opts.q || '' : '';
  const k = p.key;
  const [c1] = brandColors(p.brand);
  const tag = p.status !== 'Available' ? `<span class="badge warn card-tag">${esc(p.status)}</span>` : isNew(p) ? '<span class="badge new card-tag">New</span>' : '';
  return `
    <article class="card glass${opts.reveal === false ? '' : ' reveal'}" style="--c1:${c1}">
      ${tag}
      <div class="card-like">${likeBtn(p)}</div>
      <a class="card-media" href="#/phone/${esc(p.id)}" tabindex="-1" aria-hidden="true">${thumb(p, 'md')}</a>
      <a class="card-title" href="#/phone/${esc(p.id)}">
        <div class="brand">${brandLabel(p.brand)}</div>
        <h3>${highlight(p.name, q)}</h3>
        <div class="date">${fmtDate(p.announced)}</div>
      </a>
      <ul class="mini-specs">
        <li title="Display">${icon('display')}<span><b>${k.displayIn ?? '—'}″</b> ${k.refreshHz ? k.refreshHz + 'Hz' : ''}</span></li>
        <li title="Battery">${icon('battery')}<span><b>${k.batteryMah ? num(k.batteryMah) : '—'}</b> mAh</span></li>
        <li title="Chipset">${icon('chip')}<span><b>${highlight(k.chip ?? '—', q)}</b></span></li>
        <li title="Main camera">${icon('camera')}<span><b>${k.mainCamMP ?? '—'}MP</b> main</span></li>
      </ul>
      <div class="card-foot">
        <div class="price">${cardPrice(p)}</div>
        ${compareBtn(p)}
      </div>
    </article>`;
}

export function sectionHead(title, sub = '', href = '', linkText = 'See all') {
  return `
    <div class="section-head">
      <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      ${href ? `<a class="see-all" href="${href}">${linkText} ${icon('arrowR')}</a>` : ''}
    </div>`;
}

export function emptyState(ic, title, text, action = '') {
  return `<div class="empty glass reveal"><div class="ico">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
}

export function toast(message, ic = 'check') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(ic)}<span>${esc(message)}</span>`;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2200);
}
