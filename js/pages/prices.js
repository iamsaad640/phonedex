import { store, BUDGETS, inBudget } from '../store.js';
import { app, esc, icon, phoneCard, setTitle, fmtDate } from '../ui.js';

export function render({ params }) {
  setTitle('Prices in Pakistan');
  const selected = BUDGETS.find((b) => b.key === params.get('range'));
  const byPrice = (a, b) => a.pricePKR - b.pricePKR;
  const groups = (selected ? [selected] : BUDGETS).map((b) => ({
    title: b.label,
    phones: store.phones.filter((p) => inBudget(p, b)).sort(byPrice),
  }));
  if (!selected) {
    groups.push({
      title: 'Not sold in Pakistan yet',
      sub: 'Showing official launch prices in USD.',
      phones: store.phones.filter((p) => p.pricePKR == null),
    });
  }

  let i = 0;
  app.innerHTML = `
    <header class="page-head reveal">
      <span class="eyebrow">${icon('tag')}Prices</span>
      <h1>Mobile prices in Pakistan</h1>
      <p>Retail prices from priceoye.pk, last checked ${fmtDate(store.updated)}. Prices move often, so confirm with the seller before you buy.</p>
    </header>
    <div class="chips reveal" style="--i:1;margin-bottom:6px">
      <a class="chip ${selected ? '' : 'on'}" href="#/prices">All budgets</a>
      ${BUDGETS.map((b) => `<a class="chip ${selected === b ? 'on' : ''}" href="#/prices?range=${b.key}">${esc(b.short)}</a>`).join('')}
    </div>
    ${groups.map((g) => `
      <section class="section" style="margin-top:34px">
        <div class="section-head"><div><h2>${esc(g.title)}</h2><p>${g.sub ? esc(g.sub) + ' · ' : ''}${g.phones.length} phone${g.phones.length === 1 ? '' : 's'}</p></div></div>
        ${g.phones.length
          ? `<div class="grid">${g.phones.map((p) => phoneCard(p, i++)).join('')}</div>`
          : '<p class="muted">No phones in this range yet.</p>'}
      </section>`).join('')}`;
}
