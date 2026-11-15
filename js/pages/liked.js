import { store } from '../store.js';
import { app, icon, phoneCard, setTitle, emptyState } from '../ui.js';

export function render() {
  setTitle('Liked phones');
  const phones = store.liked.map((id) => store.byId.get(id)).filter(Boolean);
  const compareIds = phones.slice(0, 3).map((p) => p.id).join(',');

  app.innerHTML = `
    <header class="page-head reveal" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap">
      <div>
        <span class="eyebrow">${icon('heart')}Your list</span>
        <h1>Liked phones</h1>
        <p>Phones you've hearted, saved on this device.</p>
      </div>
      ${phones.length >= 2 ? `<a class="btn primary" href="#/compare?ids=${compareIds}">${icon('swap')}Compare ${Math.min(phones.length, 3)} liked</a>` : ''}
    </header>
    ${phones.length
      ? `<div class="grid" id="likedGrid">${phones.map((p, i) => phoneCard(p, i)).join('')}</div>`
      : emptyState('heart', 'No liked phones yet', 'Tap the heart on any phone to save it here.', '<a class="btn primary" href="#/phones">Browse phones</a>')}`;
}
