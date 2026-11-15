import { store } from '../store.js';
import {
  app, esc, num, icon, thumb, fullName, fmtDate, fmtUSD, fmtStorage, brandColors,
  compareBtn, likeBtn, statusBadge, verifiedBadge, setTitle, emptyState, phoneCard, sectionHead, priceInfo, brandLabel,
} from '../ui.js';

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

function priceGap(a, b) {
  if (a.pricePKR != null && b.pricePKR != null) return Math.abs(a.pricePKR - b.pricePKR) / a.pricePKR;
  if (a.priceUSD != null && b.priceUSD != null) return Math.abs(a.priceUSD - b.priceUSD) / a.priceUSD;
  return 1;
}

// Closest in price first; same brand and similar screen size break ties.
function similar(p) {
  return store.phones
    .filter((s) => s.id !== p.id)
    .map((s) => ({
      s,
      score: priceGap(p, s) + (s.brand === p.brand ? 0 : 0.08) + Math.abs((s.key.displayIn ?? 6.7) - (p.key.displayIn ?? 6.7)) * 0.05,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 8)
    .map((x) => x.s);
}

export function render({ parts }) {
  const p = store.byId.get(decodeURIComponent(parts[1] || ''));
  if (!p) {
    setTitle('Not found');
    app.innerHTML = `<div style="margin-top:40px">${emptyState('search', 'Phone not found', 'It may have been renamed or removed.', '<a class="btn primary" href="#/phones">Browse all phones</a>')}</div>`;
    return;
  }
  setTitle(`${fullName(p)} — Full specs & price`);
  const k = p.key;
  const [c1] = brandColors(p.brand);
  const price = priceInfo(p, 'PKR');

  const stats = [
    ['display', 'Display', k.displayIn ? `${k.displayIn}″` : '—', k.refreshHz ? `${k.refreshHz}Hz · ${p.specs.Display?.Type ?? ''}` : ''],
    ['chip', 'Chipset', esc(k.chip ?? '—'), esc(p.specs.Platform?.CPU ?? '')],
    ['camera', 'Main camera', k.mainCamMP ? `${k.mainCamMP} MP` : '—', esc(p.specs['Main camera']?.Setup ?? '')],
    ['battery', 'Battery', k.batteryMah ? `${num(k.batteryMah)} mAh` : 'Not published', k.chargingW ? `${k.chargingW}W wired` : ''],
    ['grid', 'Memory', k.ramGB ? `${k.ramGB} GB RAM` : 'Not published', k.storageMinGB ? `from ${fmtStorage(k.storageMinGB)}` : ''],
    ['weight', 'Weight', k.weightG ? `${k.weightG} g` : '—', esc(p.specs.Body?.['IP rating'] ?? '')],
  ];

  app.innerHTML = `
    <nav class="crumbs reveal" aria-label="Breadcrumb">
      <a href="#/phones">Phones</a>${icon('chevR')}
      <a href="#/brand/${encodeURIComponent(p.brand)}">${esc(p.brand)}</a>${icon('chevR')}
      <span>${esc(p.name)}</span>
    </nav>

    <section class="detail-head glass" style="--c1:${c1}">
      <div class="detail-stage">
        ${thumb(p, 'lg', { alt: fullName(p), eager: true, name: 'phone-hero' })}
        ${p.imageCredit ? `<span class="credit">Image: ${esc(p.imageCredit)}</span>` : ''}
      </div>
      <div class="reveal">
        <a class="detail-brand" href="#/brand/${encodeURIComponent(p.brand)}">${brandLabel(p.brand)}</a>
        <div class="badges">${statusBadge(p)} ${verifiedBadge(p)}</div>
        <h1>${esc(fullName(p))}</h1>
        <div class="muted">Announced ${fmtDate(p.announced)} · ${esc(k.os ?? '')}</div>
        <div class="detail-actions">
          ${compareBtn(p)}
          <button class="btn btn-sm" data-open-chat data-prompt="Is the ${esc(fullName(p))} a good buy? ">${icon('sparkle')}Ask about this phone</button>
        </div>
      </div>
      <div class="price-box reveal">
        ${likeBtn(p)}
        <div class="big">${price.value}</div>
        <div class="sub">${esc(price.note)}${p.pricePKR != null && p.priceUSD != null ? ` · launch ${fmtUSD(p.priceUSD)}` : ''}</div>
        ${p.pricePKR == null ? `<div class="sub muted-note">Not sold in Pakistan yet${store.fx ? ` · rate of ${fmtDate(store.fx.date)}` : ''}</div>` : ''}
      </div>
    </section>

    <div class="stats">
      ${stats.map(([ic, l, v, h], i) => `
        <div class="stat glass reveal">
          <div class="label">${icon(ic)}${l}</div>
          <div class="value">${v}</div>
          <div class="hint">${h}</div>
        </div>`).join('')}
    </div>

    <div class="spec-layout">
      <div class="spec-table glass reveal" style="--i:3">
        ${Object.entries(p.specs).map(([section, rows]) => `
          <section class="spec-section">
            <h2>${esc(section)}</h2>
            <dl>${Object.entries(rows).map(([key, v]) => `<dt>${esc(key)}</dt><dd>${esc(v ?? '—')}</dd>`).join('')}</dl>
          </section>`).join('')}
      </div>
      <aside class="side">
        <div class="panel glass reveal">
          <h3>Sources</h3>
          <ul>${(p.sources || []).map((u) => `<li><a class="link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(u))}</a></li>`).join('')}</ul>
          <p class="muted" style="font-size:12px;margin:10px 0 0">Prices last checked ${fmtDate(store.updated)}.</p>
        </div>
      </aside>
    </div>

    <section class="section">
      ${sectionHead('Similar phones', 'Closest in price, then brand and screen size.')}
      <div class="rail-wrap">
        <button class="rail-btn prev" aria-label="Scroll left">${icon('chevL')}</button>
        <div class="rail" id="similarRail">${similar(p).map((s) => phoneCard(s)).join('')}</div>
        <button class="rail-btn next" aria-label="Scroll right">${icon('chevR')}</button>
      </div>
    </section>`;

  const rail = app.querySelector('#similarRail');
  const prev = app.querySelector('.rail-btn.prev');
  const next = app.querySelector('.rail-btn.next');
  const sync = () => {
    prev.disabled = rail.scrollLeft <= 4;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
  };
  const page = (dir) => rail.scrollBy({ left: dir * rail.clientWidth * 0.85, behavior: 'smooth' });
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  rail.addEventListener('scroll', sync, { passive: true });
  sync();
}
