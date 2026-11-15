import { brandList } from '../store.js';
import { app, esc, icon, phoneCard, setTitle, brandBadge, fmtDate, emptyState } from '../ui.js';

export function renderBrands() {
  setTitle('Brands');
  const brands = brandList();
  app.innerHTML = `
    <header class="page-head reveal">
      <span class="eyebrow">${icon('brands')}Brands</span>
      <h1>Browse by brand</h1>
      <p>${brands.length} brands, from flagship makers to the best-sellers in Pakistan.</p>
    </header>
    <div class="tiles">
      ${brands.map((b) => {
        const latest = b.phones[0];
        return `
          <a class="brand-tile glass reveal" href="#/brand/${encodeURIComponent(b.name)}">
            ${brandBadge(b.name)}
            <span><b>${esc(b.name)}</b><small>${b.phones.length} phone${b.phones.length === 1 ? '' : 's'} · latest: ${esc(latest.name)}, ${fmtDate(latest.announced)}</small></span>
          </a>`;
      }).join('')}
    </div>`;
}

export function renderBrand({ parts }) {
  const name = decodeURIComponent(parts[1] || '');
  const brand = brandList().find((b) => b.name.toLowerCase() === name.toLowerCase());
  if (!brand) {
    setTitle('Brand not found');
    app.innerHTML = `<div style="margin-top:40px">${emptyState('brands', 'Brand not found', `We don't list ${esc(name)} phones yet.`, '<a class="btn primary" href="#/brands">All brands</a>')}</div>`;
    return;
  }
  setTitle(`${brand.name} phones`);
  app.innerHTML = `
    <nav class="crumbs reveal"><a href="#/brands">Brands</a>${icon('chevR')}<span>${esc(brand.name)}</span></nav>
    <header class="page-head reveal" style="display:flex;gap:18px;align-items:center;margin-top:8px">
      ${brandBadge(brand.name, 'width:72px;height:72px;border-radius:22px')}
      <div>
        <h1>${esc(brand.name)} phones</h1>
        <p>${brand.phones.length} model${brand.phones.length === 1 ? '' : 's'} listed, newest first.</p>
      </div>
    </header>
    <div class="grid">${brand.phones.map((p, i) => phoneCard(p, i)).join('')}</div>`;
}
