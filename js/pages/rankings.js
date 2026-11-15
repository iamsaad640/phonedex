import { store } from '../store.js';
import { app, esc, num, icon, thumb, fullName, setTitle, cardPrice } from '../ui.js';

export const METRICS = [
  { key: 'battery', label: 'Biggest battery', ic: 'battery', get: (p) => p.key.batteryMah, fmt: (v) => `${num(v)} mAh` },
  { key: 'camera', label: 'Highest-res camera', ic: 'camera', get: (p) => p.key.mainCamMP, fmt: (v) => `${v} MP` },
  { key: 'charging', label: 'Fastest charging', ic: 'bolt', get: (p) => p.key.chargingW, fmt: (v) => `${v} W` },
  { key: 'display', label: 'Biggest display', ic: 'display', get: (p) => p.key.displayIn, fmt: (v) => `${v}″` },
  { key: 'refresh', label: 'Smoothest display', ic: 'gauge', get: (p) => p.key.refreshHz, fmt: (v) => `${v} Hz` },
  { key: 'light', label: 'Lightest', ic: 'weight', get: (p) => p.key.weightG, fmt: (v) => `${v} g`, lowerIsBetter: true },
];

export function render({ params }) {
  setTitle('Top charts');
  const m = METRICS.find((x) => x.key === params.get('by')) || METRICS[0];
  const ranked = store.phones.filter((p) => m.get(p) != null)
    .sort((a, b) => (m.lowerIsBetter ? m.get(a) - m.get(b) : m.get(b) - m.get(a)));
  const missing = store.phones.length - ranked.length;
  const values = ranked.map(m.get);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = (v) => (m.lowerIsBetter ? (min / v) * 100 : (v / max) * 100);

  app.innerHTML = `
    <header class="page-head reveal">
      <span class="eyebrow">${icon('chart')}Top charts</span>
      <h1>${esc(m.label)}</h1>
      <p>Ranked purely by the spec sheet, not by reviews. ${missing ? `${missing} phone${missing === 1 ? ' doesn’t' : 's don’t'} publish this figure and ${missing === 1 ? 'is' : 'are'} left out.` : ''}</p>
    </header>
    <div class="chips reveal" style="--i:1;margin-bottom:18px">
      ${METRICS.map((x) => `<a class="chip ${x.key === m.key ? 'on' : ''}" href="#/rankings?by=${x.key}">${icon(x.ic)}${esc(x.label)}</a>`).join('')}
    </div>
    <div class="rank-list glass reveal" style="--i:2">
      ${ranked.map((p, i) => `
        <a class="rank-row" href="#/phone/${esc(p.id)}">
          <span class="rank-no">${i + 1}</span>
          ${thumb(p, 'sm')}
          <span class="rank-name">${esc(fullName(p))}<small>${cardPrice(p).replace(/<small>.*<\/small>/, '')}</small></span>
          <span class="bar"><span style="width:${width(m.get(p)).toFixed(1)}%;--i:${Math.min(i, 15)}"></span></span>
          <span class="rank-val">${esc(m.fmt(m.get(p)))}</span>
        </a>`).join('')}
    </div>`;
}
