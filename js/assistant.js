// Offline answer engine used when the AI server isn't reachable (e.g. static hosting).
// It answers only from the catalog, so it can't contradict the spec pages.
import { store } from './store.js';
import { fullName, num, fmtPKR, fmtUSD, fmtDate } from './ui.js';

export const FOUNDER = 'M. Sufyan Mughal';

const norm = (s) => s.toLowerCase().replace(/\+/g, ' plus').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const link = (p) => `[${fullName(p)}](#/phone/${p.id})`;
const priceText = (p) => (p.pricePKR != null
  ? fmtPKR(p.pricePKR)
  : p.approx
    ? `about ${fmtPKR(p.approx.pkr)} (converted from its ${p.approx.from} launch price; not sold in Pakistan yet)`
    : 'price not announced yet');
const priceOf = (p, cur = 'PKR') => (cur === 'USD' ? p.priceUSD : p.pricePKR);

/* ---------- phone name matching ---------- */
let aliasIndex = null;
function aliases() {
  if (aliasIndex && aliasIndex.size === store.phones.length) return aliasIndex.list;
  const list = [];
  for (const p of store.phones) {
    const name = norm(p.name);
    const set = new Set([norm(fullName(p)), name]);
    for (const prefix of ['galaxy ', 'poco ']) if (name.startsWith(prefix)) set.add(name.slice(prefix.length));
    if (p.brand === 'Apple') set.add(name.replace(/^iphone /, 'iphone'));
    if (p.brand === 'Google') set.add(name.replace(/^pixel /, 'pixel'));
    for (const a of [...set]) {
      if (a.endsWith(' 5g')) set.add(a.slice(0, -3));
      if (/ (\d+)$/.test(a)) set.add(a.replace(/ (\d+)$/, '$1'));
    }
    for (const a of set) if (a.length >= 3 && /[a-z]/.test(a) && /\d|\s/.test(a)) list.push({ a, p });
  }
  list.sort((x, y) => y.a.length - x.a.length);
  aliasIndex = { size: store.phones.length, list };
  return list;
}

function findPhones(text) {
  let s = ` ${norm(text)} `;
  const found = [];
  for (const { a, p } of aliases()) {
    const needle = ` ${a} `;
    if (s.includes(needle)) {
      if (!found.includes(p)) found.push(p);
      s = s.split(needle).join(' | ');
    }
  }
  return { phones: found, rest: s };
}

function findBrand(text) {
  const t = norm(text);
  if (/\biphone|\bapple\b/.test(t)) return 'Apple';
  if (/\bpixel\b/.test(t)) return 'Google';
  if (/\bredmi\b|\bpoco\b|\bmi\b/.test(t)) return 'Xiaomi';
  if (/\bcmf\b/.test(t)) return 'Nothing';
  if (/\bmoto\b/.test(t)) return 'Motorola';
  const brands = [...new Set(store.phones.map((p) => p.brand))];
  return brands.find((b) => new RegExp(`\\b${b.toLowerCase()}\\b`).test(t)) || null;
}

/* ---------- budgets: "under 80k", "50 se 80 hazar", "1 lakh tak", "$800" ---------- */
function toAmount(n, unit, usd) {
  let v = parseFloat(n);
  if (/^k|thousand|hazar|hazaar/.test(unit || '')) v *= 1000;
  else if (/lakh|lac|lakh/.test(unit || '')) v *= 100000;
  else if (!usd && v < 1000) v *= 1000;
  return Math.round(v);
}
export function parseBudget(text) {
  const t = text.toLowerCase().replace(/,/g, '');
  const usd = /\$|\busd\b|dollar/.test(t);
  const cur = usd ? 'USD' : 'PKR';
  const U = '(k\\b|lakh|lac|thousand|hazaa?r)?';
  const range = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${U}\\s*(?:-|to|se|and|aur|–)\\s*\\$?(\\d+(?:\\.\\d+)?)\\s*${U}`));
  if (range && /between|range|se|to|-|–|budget|\d\s*k/.test(t)) {
    const hiUnit = range[4] || range[2];
    const lo = toAmount(range[1], range[2] || hiUnit, usd);
    const hi = toAmount(range[3], hiUnit, usd);
    if (hi > lo) return { min: lo, value: hi, currency: cur };
  }
  const m = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${U}`));
  const cue = /under|below|less than|within|up ?to|budget|around|max|tak|se kam|andar|rs\.?|pkr|\$|lakh|lac|\d\s*k\b|hazaa?r|usd|dollar/.test(t);
  if (!m || !cue) return null;
  return { value: toAmount(m[1], m[2], usd), currency: cur };
}

/* ---------- intents ---------- */
const ATTRS = [
  ['price', /price|cost|kitn|qeemat|qeem|rate\b|how much|kitne|kitna/],
  ['camera', /camera|photo|picture|selfie|\bmp\b|megapixel|zoom|video|tiktok|vlog/],
  ['charging', /charg|watt/],
  ['battery', /battery|mah|backup|timing|lasts?\b/],
  ['refresh', /refresh|\bhz\b|smooth/],
  ['display', /display|screen|inch|bigger|amoled/],
  ['light', /light(est|weight)?\b|weight|heavy|gram/],
  ['performance', /chip|processor|cpu|gaming|game|performance|speed|pubg|free ?fire|fast phone|powerful/],
  ['memory', /storage|\bram\b|memory|\bgb\b/],
  ['os', /android|ios|update|software|\bos\b/],
];
const detectAttr = (t) => (ATTRS.find(([, re]) => re.test(t)) || [null])[0];

// Chipset classes, strongest first. Only well-established chips are listed; unknown chips rank last.
const CHIP_TIERS = [
  [/8 elite|a19 pro|a20|dimensity 9[45]\d0|exynos 2[56]00|kirin 9030|tensor g[56]/, 5],
  [/8 gen 3|8s gen 4|a19\b|a18|dimensity 9[23]\d0|dimensity 8[45]\d0|exynos 2400|tensor g4|kirin 90[12]0/, 4],
  [/7\+ gen|8s gen 3|7 gen 4|dimensity 8[0-3]\d0|dimensity 7[34]\d0|exynos 1[5-6]\d0|snapdragon 7s gen 4/, 3],
  [/7s gen|6 gen|dimensity 7[0-2]\d0|dimensity 6\d00|exynos 1[34]\d0|helio g2\d\d|helio g1[0-9]\d|unisoc t8/, 2],
  [/helio|unisoc|snapdragon 4|dimensity 6/, 1],
];
const chipTier = (p) => {
  const c = (p.key.chip || '').toLowerCase();
  return (CHIP_TIERS.find(([re]) => re.test(c)) || [null, 0])[1];
};

const METRIC = {
  battery: { get: (p) => p.key.batteryMah, fmt: (v) => `${num(v)} mAh`, label: 'biggest battery' },
  camera: { get: (p) => p.key.mainCamMP, fmt: (v) => `${v}MP main camera`, label: 'highest-resolution main camera' },
  charging: { get: (p) => p.key.chargingW, fmt: (v) => `${v}W charging`, label: 'fastest wired charging' },
  display: { get: (p) => p.key.displayIn, fmt: (v) => `${v}″ display`, label: 'biggest display' },
  refresh: { get: (p) => p.key.refreshHz, fmt: (v) => `${v}Hz display`, label: 'highest refresh rate' },
  light: { get: (p) => p.key.weightG, fmt: (v) => `${v} g`, label: 'lightest build', low: true },
  performance: {
    get: (p) => (chipTier(p) ? chipTier(p) * 1000 + (p.key.refreshHz || 0) + (p.key.ramGB || 0) : null),
    fmt: (_, p) => `${p.key.chip}${p.key.refreshHz ? `, ${p.key.refreshHz}Hz` : ''}${p.key.ramGB ? `, ${p.key.ramGB}GB RAM` : ''}`,
    label: 'strongest chipset class',
  },
};

// Filters that come straight from the spec sheet.
const FILTERS = [
  [/\b5g\b/, '5G', (p) => /5g/i.test(p.specs.Connectivity?.Network || '') || /\b5g\b/i.test(p.name)],
  [/fold|flip|foldable/, 'foldable', (p) => /fold|flip|razr/i.test(p.name)],
  [/compact|small|chota|one hand/, 'compact', (p) => p.key.displayIn != null && p.key.displayIn <= 6.4],
  [/wireless/, 'wireless charging', (p) => { const w = p.specs.Battery?.Wireless; return !!w && !/^no\b/i.test(w); }],
  [/waterproof|water ?resist|ip6[89]|pani/, 'IP68-rated', (p) => /ip6[89]/i.test(p.specs.Body?.['IP rating'] || '')],
  [/telephoto|periscope|optical zoom/, 'telephoto camera', (p) => !!p.specs['Main camera']?.Telephoto],
  [/memory card|sd card|card slot/, 'memory card slot', (p) => /yes|microsd/i.test(p.specs.Memory?.['Card slot'] || '')],
];

/* ---------- answers ---------- */
function phoneDetail(p, attr) {
  const s = p.specs;
  const lines = {
    price: [`**${priceText(p)}**${p.pricePKR != null && p.priceUSD != null ? ` in Pakistan (launch price ${fmtUSD(p.priceUSD)})` : ''}.`, `Prices checked ${fmtDate(store.updated)}; confirm with the seller.`],
    camera: [`- Main: **${s['Main camera']?.Main ?? '—'}**`, s['Main camera']?.Ultrawide && `- Ultrawide: ${s['Main camera'].Ultrawide}`, s['Main camera']?.Telephoto && `- Telephoto: ${s['Main camera'].Telephoto}`, `- Selfie: ${s['Selfie camera']?.Camera ?? '—'}`, s['Main camera']?.Video && `- Video: ${s['Main camera'].Video}`],
    battery: [`- Capacity: **${s.Battery?.Capacity ?? 'not published by the maker'}**`, `- Wired: ${s.Battery?.Wired ?? '—'}`, `- Wireless: ${s.Battery?.Wireless ?? '—'}`],
    charging: [`- Wired: **${s.Battery?.Wired ?? '—'}**`, `- Wireless: ${s.Battery?.Wireless ?? '—'}`],
    display: [`- **${s.Display?.Size ?? '—'}** ${s.Display?.Type ?? ''}`, `- Resolution: ${s.Display?.Resolution ?? '—'}`, `- Refresh rate: ${s.Display?.['Refresh rate'] ?? '—'}`, s.Display?.Brightness && `- Brightness: ${s.Display.Brightness}`],
    refresh: [`- Refresh rate: **${s.Display?.['Refresh rate'] ?? '—'}**`],
    light: [`- Weight: **${s.Body?.Weight ?? '—'}**`, `- Size: ${s.Body?.Dimensions ?? '—'}`],
    performance: [`- Chipset: **${s.Platform?.Chipset ?? p.key.chip ?? '—'}**`, s.Platform?.CPU && `- CPU: ${s.Platform.CPU}`, `- RAM: ${s.Memory?.RAM ?? '—'}`, p.key.refreshHz && `- Display: ${p.key.refreshHz}Hz`],
    memory: [`- RAM: **${s.Memory?.RAM ?? '—'}**`, `- Storage: ${s.Memory?.Storage ?? '—'}`, `- Card slot: ${s.Memory?.['Card slot'] ?? '—'}`],
    os: [`- Software: **${s.Platform?.OS ?? p.key.os ?? '—'}**`],
  }[attr];
  const titles = { light: 'size and weight', performance: 'performance', os: 'software' };
  if (lines) return [`Here's the ${titles[attr] ?? attr} info for ${link(p)}:`, ...lines.filter(Boolean)].join('\n');

  const k = p.key;
  return [
    `${link(p)}, announced ${fmtDate(p.announced)}:`,
    `- Price: **${priceText(p)}**`,
    `- Display: ${k.displayIn ?? '—'}″${k.refreshHz ? `, ${k.refreshHz}Hz` : ''}`,
    `- Chip: ${k.chip ?? '—'}`,
    `- Camera: ${k.mainCamMP ?? '—'}MP main`,
    `- Battery: ${k.batteryMah ? num(k.batteryMah) + ' mAh' : 'not published'}${k.chargingW ? `, ${k.chargingW}W charging` : ''}`,
    k.ramGB ? `- Memory: ${k.ramGB}GB RAM, from ${k.storageMinGB}GB storage` : '',
    'Open the phone page for the full spec sheet.',
  ].filter(Boolean).join('\n');
}

function verdict(p) {
  const rivals = store.phones.filter((s) => s.id !== p.id && s.pricePKR != null && p.pricePKR != null && Math.abs(s.pricePKR - p.pricePKR) / p.pricePKR < 0.2);
  const k = p.key;
  const pros = [];
  if (rivals.length) {
    const beats = (get) => {
      const vals = rivals.map(get).filter((v) => v != null);
      return get(p) != null && vals.length > 0 && vals.every((v) => get(p) >= v) && vals.some((v) => get(p) > v);
    };
    if (beats((x) => x.key.batteryMah)) pros.push(`the biggest battery in its price range (${num(k.batteryMah)} mAh)`);
    if (beats((x) => x.key.chargingW)) pros.push(`the fastest charging in its price range (${k.chargingW}W)`);
    if (beats((x) => x.key.mainCamMP)) pros.push(`the highest-resolution main camera in its price range (${k.mainCamMP}MP)`);
    if (beats(chipTier) && chipTier(p) >= 3) pros.push(`one of the strongest chips in its price range (${k.chip})`);
  }
  const lines = [`Here's how the ${link(p)} stacks up${p.pricePKR != null ? ` at **${fmtPKR(p.pricePKR)}**` : ''}:`];
  if (pros.length) lines.push(...pros.map((x) => `- It has ${x}.`));
  else lines.push(`- ${k.chip ?? 'Unlisted chip'}, ${k.mainCamMP ?? '—'}MP main camera, ${k.batteryMah ? num(k.batteryMah) + ' mAh' : 'unpublished battery'}${k.chargingW ? `, ${k.chargingW}W` : ''}.`);
  if (rivals.length) {
    const alt = rivals.sort((a, b) => Math.abs(a.pricePKR - p.pricePKR) - Math.abs(b.pricePKR - p.pricePKR)).slice(0, 2);
    lines.push(`Similar-priced alternatives: ${alt.map((a) => `${link(a)} (${fmtPKR(a.pricePKR)})`).join(', ')}.`);
    lines.push(`[Compare them side by side](#/compare?ids=${[p, ...alt].map((x) => x.id).join(',')})`);
  } else if (p.pricePKR == null) {
    lines.push("It isn't sold in Pakistan yet, so I can't compare it against local prices.");
  }
  return lines.join('\n');
}

function compareAnswer(phones) {
  const ps = phones.slice(0, 3);
  const win = (label, get, low = false, fmt = null) => {
    const vals = ps.map((p) => ({ p, v: get(p) })).filter((x) => x.v != null && x.v !== 0);
    if (vals.length < 2) return null;
    vals.sort((a, b) => (low ? a.v - b.v : b.v - a.v));
    if (vals[0].v === vals[1].v) return null;
    return `- ${label}: **${fullName(vals[0].p)}**${fmt ? ` (${fmt(vals[0].p)})` : ''}`;
  };
  return [
    `Quick comparison of ${ps.map(link).join(' vs ')}:`,
    win('Stronger chipset class', chipTier, false, (p) => p.key.chip),
    win('Bigger battery', (p) => p.key.batteryMah, false, (p) => `${num(p.key.batteryMah)} mAh`),
    win('Higher-res main camera', (p) => p.key.mainCamMP, false, (p) => `${p.key.mainCamMP}MP`),
    win('Faster charging', (p) => p.key.chargingW, false, (p) => `${p.key.chargingW}W`),
    win('Smoother display', (p) => p.key.refreshHz, false, (p) => `${p.key.refreshHz}Hz`),
    win('Lighter', (p) => p.key.weightG, true, (p) => `${p.key.weightG} g`),
    win('Cheaper in Pakistan', (p) => p.pricePKR, true),
    ...ps.map((p) => `- ${fullName(p)}: ${priceText(p)}`),
    `[See the full side-by-side comparison](#/compare?ids=${ps.map((p) => p.id).join(',')})`,
  ].filter(Boolean).join('\n');
}

function listAnswer({ attr, budget, brand, filters, order }) {
  let pool = store.phones.slice();
  const brandWord = brand ? `${brand} ` : '';
  const money = (v) => (budget.currency === 'PKR' ? fmtPKR(v) : fmtUSD(v));
  const budgetWord = budget ? (budget.min ? ` between ${money(budget.min)} and ${money(budget.value)}` : ` under ${money(budget.value)}`) : '';
  const filterWord = filters.length ? ` (${filters.map((f) => f[1]).join(', ')})` : '';
  if (brand) pool = pool.filter((p) => p.brand === brand);
  for (const [, , test] of filters) pool = pool.filter(test);
  if (budget) {
    pool = pool.filter((p) => {
      const v = priceOf(p, budget.currency);
      return v != null && v <= budget.value && (!budget.min || v >= budget.min);
    });
  }
  if (!pool.length) {
    return `I couldn't find any ${brandWord}phones${filterWord}${budgetWord} in PhoneDex right now. Try a wider budget, or [browse prices by range](#/prices).`;
  }

  const metric = METRIC[attr];
  const cur = budget?.currency || 'PKR';
  let ranked;
  let why;
  let heading;
  if (order === 'cheap') {
    ranked = pool.filter((p) => priceOf(p, cur) != null).sort((a, b) => priceOf(a, cur) - priceOf(b, cur));
    why = (p) => `${p.key.chip}, ${p.key.batteryMah ? num(p.key.batteryMah) + ' mAh' : '—'}`;
    heading = `Most affordable ${brandWord}phones${filterWord}${budgetWord}:`;
  } else if (order === 'new') {
    ranked = pool.slice().sort((a, b) => b.announced.localeCompare(a.announced));
    why = (p) => `announced ${fmtDate(p.announced)}`;
    heading = `Newest ${brandWord}phones${filterWord}${budgetWord}:`;
  } else if (metric) {
    ranked = pool.filter((p) => metric.get(p) != null).sort((a, b) =>
      (metric.low ? metric.get(a) - metric.get(b) : metric.get(b) - metric.get(a)) || (priceOf(a, cur) ?? 1e9) - (priceOf(b, cur) ?? 1e9));
    why = (p) => metric.fmt(metric.get(p), p);
    heading = `${brand ? `${brand} phones` : 'Phones'}${filterWord}${budgetWord} with the ${metric.label}:`;
  } else {
    // No single number captures "best overall", so lead with the strongest chip class, then the most premium.
    ranked = pool.filter((p) => priceOf(p, cur) != null || !budget)
      .sort((a, b) => chipTier(b) - chipTier(a) || (priceOf(b, cur) ?? 0) - (priceOf(a, cur) ?? 0));
    why = (p) => `${p.key.chip}, ${p.key.mainCamMP}MP camera${p.key.batteryMah ? `, ${num(p.key.batteryMah)} mAh` : ''}`;
    heading = `Top ${brandWord}picks${filterWord}${budgetWord}:`;
  }
  const top = ranked.slice(0, 3);
  if (!top.length) return `PhoneDex doesn't have that figure for any ${brandWord}phones${budgetWord} yet.`;
  return [
    heading,
    ...top.map((p, i) => `${i + 1}. ${link(p)}: ${why(p)} · **${priceText(p)}**`),
    attr === 'performance' ? 'Ranked by chipset class, then refresh rate and RAM, not by benchmark scores.' : '',
    metric && attr !== 'performance' ? `[See the full chart](#/rankings?by=${attr})` : budget ? '' : '[Browse all prices](#/prices)',
    budget ? '' : 'Tell me your budget and I can narrow this down.',
  ].filter(Boolean).join('\n');
}

const FAQ = [
  [/\b(ceo|founder|owner|founded|who (made|built|created|owns|runs)|kis ne banai|malik|banane wala)\b/, () => `The Founder & CEO of PhoneDex is **${FOUNDER}**. [Visit the Founder page](#/founder).`],
  [/accura|correct|verified|source|reliable|trust|sahi/, () => 'Specs come from manufacturer spec sheets wherever possible; those phones have an **Official specs** badge. The rest come from established spec databases. Every phone page links its sources, and we leave values blank instead of guessing.'],
  [/up ?-?to ?-?date|updated?\b|latest price|price.*(old|current|today|fresh)|\bkab\b/, () => `Pakistan prices are retail prices from priceoye.pk, last checked **${fmtDate(store.updated)}**. They change often, so confirm with the seller before buying.`],
  [/\bpta\b|warranty|official warranty|shop|buy from|order|deliver|installment|qist/, () => 'PhoneDex is a spec and price guide, so I can’t place orders, check stock or arrange instalments. Please confirm PTA approval and warranty with the seller before you pay.'],
  [/how.*compare|compare.*how/, () => 'Tap **Compare** on up to 3 phones, then open the tray at the bottom of the screen, or go to [Compare](#/compare). The better number in each row gets a green tick.'],
  [/\blike\b|heart|saved|favou?rite/, () => 'Tap the heart on any phone to save it. Your saved phones are on the [Liked](#/liked) page, stored on this device only.'],
  [/how many phones|kitne phones|catalog|database size/, () => `PhoneDex lists **${store.phones.length} phones** from ${new Set(store.phones.map((p) => p.brand)).size} brands, announced between 2025 and today. [Browse them all](#/phones).`],
  [/contact|human|email|complain|support/, () => 'You can find answers on the [Support page](#/support). I’m happy to help with phones, specs and prices right here too.'],
];

const REFERS_BACK = /\b(it|its|it's|this|that|this one|that one|is ka|iska|iski|is ki|us ki|uski|uska|them|these|both|dono)\b/;

// Phones the assistant mentioned most recently, newest first.
function recentPhones(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const ids = [...history[i].content.matchAll(/#\/phone\/([a-z0-9-]+)/g)].map((m) => m[1]);
    const userPhones = history[i].role === 'user' ? findPhones(history[i].content).phones : [];
    const list = [...new Set([...ids.map((id) => store.byId.get(id)).filter(Boolean), ...userPhones])];
    if (list.length) return list;
  }
  return [];
}

export function localAnswer(text, history = []) {
  const raw = text.trim();
  const t = raw.toLowerCase();
  if (/^(hi|hello|hey|salam|assalam|aoa|hy|hlo)\b/.test(t) && raw.length < 25) {
    return `${/salam|aoa/.test(t) ? 'Wa alaikum assalam!' : 'Hi!'} I can recommend a phone for your budget, look up specs and prices, or compare phones. What are you looking for?`;
  }
  if (/^(thanks|thank you|shukriya|thx|ty|jazak)/.test(t)) return 'You’re welcome! Anything else I can look up?';

  for (const [re, answer] of FAQ.slice(0, 1)) if (re.test(t)) return answer();

  let { phones, rest } = findPhones(raw);
  const attr = detectAttr(t);
  const wantsVerdict = /worth|good buy|should i buy|lena chahiye|le lun|acha hai|is it good|recommend(ed)?\??$/.test(t);

  // Follow-ups like "and its battery?" or "compare them" reuse the phones from the last answer.
  const asksForList = parseBudget(raw) || findBrand(rest) || /\bphones?\b|\bbest\b|\btop\b|cheap|sasta|newest|latest/.test(t);
  if (!phones.length && history.length && !asksForList) {
    const prev = recentPhones(history);
    const shortFollowUp = raw.split(/\s+/).length <= 6 && (attr || wantsVerdict);
    if (prev.length && (REFERS_BACK.test(t) || shortFollowUp || /^(and|aur|what about|or)\b/.test(t))) {
      phones = /compare|vs|dono|both|them|better/.test(t) ? prev.slice(0, 3) : [prev[0]];
    }
  }

  if (phones.length >= 2) return compareAnswer(phones);
  if (phones.length === 1) return wantsVerdict && !attr ? verdict(phones[0]) : phoneDetail(phones[0], attr);

  for (const [re, answer] of FAQ) if (re.test(t)) return answer();

  const budget = parseBudget(raw);
  const brand = findBrand(rest);
  const filters = FILTERS.filter(([re]) => re.test(t));
  const order = /cheap|sasta|sasti|lowest price|affordable|kam qeemat/.test(t) ? 'cheap' : /newest|latest|new phones?|naya|recent/.test(t) ? 'new' : null;
  const wantsList = budget || brand || attr || filters.length || order || /best|top|recommend|suggest|which|konsa|kaunsa|acha|good|buy|phone/.test(t);
  if (wantsList) return listAnswer({ attr: attr && METRIC[attr] ? attr : null, budget, brand, filters, order });

  return 'I can help with phone recommendations, specs, prices and comparisons. Try “best gaming phone under 100k”, “Galaxy S26 Ultra battery” or “compare iPhone 18 Pro and Pixel 11 Pro”.';
}

// Quick replies shown under an answer, based on what it was about.
export function followUps(reply) {
  const ids = [...new Set([...reply.matchAll(/#\/phone\/([a-z0-9-]+)/g)].map((m) => m[1]))].filter((id) => store.byId.has(id));
  if (ids.length === 1) {
    const p = store.byId.get(ids[0]);
    return [`${p.name} camera details`, `Is the ${p.name} worth it?`, `${p.name} battery and charging`];
  }
  if (ids.length >= 2) {
    const [a, b] = ids.map((id) => store.byId.get(id));
    return [`Compare ${a.name} vs ${b.name}`, `Is the ${a.name} worth it?`, 'Cheaper options'];
  }
  return ['Best gaming phone under 100k', 'Biggest battery under 60k', 'Newest Samsung phones'];
}
