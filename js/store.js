export const MAX_COMPARE = 3;

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / blocked storage */ }
  },
};

export const store = {
  phones: [],
  byId: new Map(),
  updated: null,
  compare: storage.get('pd.compare', []),
  liked: storage.get('pd.liked', []),
  currency: storage.get('pd.currency', 'PKR'),
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(kind, payload) {
  listeners.forEach((fn) => fn(kind, payload));
}

export async function loadData() {
  const res = await fetch('data/phones.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  store.updated = data.updated;
  store.fx = data.fx || null;
  store.phones = data.phones.slice().sort((a, b) => b.announced.localeCompare(a.announced));
  store.byId = new Map(store.phones.map((p) => [p.id, p]));
  store.compare = store.compare.filter((id) => store.byId.has(id));
  store.liked = store.liked.filter((id) => store.byId.has(id));
}

export const isComparing = (id) => store.compare.includes(id);
export const isLiked = (id) => store.liked.includes(id);

export function toggleCompare(id) {
  const i = store.compare.indexOf(id);
  let dropped = null;
  if (i >= 0) store.compare.splice(i, 1);
  else {
    if (store.compare.length >= MAX_COMPARE) dropped = store.compare.shift();
    store.compare.push(id);
  }
  storage.set('pd.compare', store.compare);
  emit('compare', { id, on: i < 0, dropped });
}

export function setCompare(ids) {
  store.compare = [...new Set(ids)].filter((id) => store.byId.has(id)).slice(0, MAX_COMPARE);
  storage.set('pd.compare', store.compare);
  emit('compare', {});
}

export function toggleLike(id) {
  const i = store.liked.indexOf(id);
  if (i >= 0) store.liked.splice(i, 1);
  else store.liked.unshift(id);
  storage.set('pd.liked', store.liked);
  emit('liked', { id, on: i < 0 });
}

export function setCurrency(c) {
  store.currency = c;
  storage.set('pd.currency', c);
  emit('currency', {});
}

// Best available number for sorting and filtering: real price first, converted estimate second.
export const priceOf = (p) => (store.currency === 'PKR'
  ? p.pricePKR ?? p.approx?.pkr ?? null
  : p.priceUSD ?? p.approx?.usd ?? (p.pricePKR != null && store.fx ? Math.round(p.pricePKR / store.fx.pkrPer.USD) : null));

export function brandList() {
  const map = new Map();
  for (const p of store.phones) {
    if (!map.has(p.brand)) map.set(p.brand, []);
    map.get(p.brand).push(p);
  }
  return [...map.entries()].map(([name, phones]) => ({ name, phones })).sort((a, b) => b.phones.length - a.phones.length || a.name.localeCompare(b.name));
}

// Upper bound is exclusive.
export const BUDGETS = [
  { key: 'under-50k', label: 'Under Rs 50k', short: 'Under 50k', min: 0, max: 50000 },
  { key: '50k-100k', label: 'Rs 50k – 100k', short: '50k – 100k', min: 50000, max: 100000 },
  { key: '100k-200k', label: 'Rs 100k – 200k', short: '100k – 200k', min: 100000, max: 200000 },
  { key: '200k-350k', label: 'Rs 200k – 350k', short: '200k – 350k', min: 200000, max: 350000 },
  { key: '350k-plus', label: 'Rs 350k and above', short: '350k +', min: 350000, max: Infinity },
];
export const inBudget = (p, b) => p.pricePKR != null && p.pricePKR >= b.min && p.pricePKR < b.max;
