// Merges data/src/*.json into data/phones.json and fails on schema errors.
// Phones that have a processed render in img/phones/<id>.webp get `image` and `imageCredit`.
// Usage: node scripts/build-data.mjs [--check]   (--check validates without writing)
import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'data', 'src');
const imageManifestDir = join(root, 'data', 'images', 'official');
const outFile = join(root, 'data', 'phones.json');
const checkOnly = process.argv.includes('--check');

const BRANDS = ['Apple', 'Samsung', 'Google', 'Xiaomi', 'OnePlus', 'vivo', 'OPPO', 'realme', 'Honor', 'Huawei', 'Nothing', 'Motorola', 'Tecno', 'Infinix'];
const STATUSES = ['Available', 'Coming soon'];

const REQUIRED = ['id', 'brand', 'name', 'announced', 'status', 'priceUSD', 'pricePKR', 'key', 'specs', 'sources', 'verified'];
const KEY_FIELDS = ['displayIn', 'refreshHz', 'chip', 'ramGB', 'storageMinGB', 'mainCamMP', 'batteryMah', 'chargingW', 'weightG', 'os'];
const NUMERIC_KEYS = KEY_FIELDS.filter((k) => !['chip', 'os'].includes(k));

function validate(p, file) {
  const errs = [];
  for (const f of REQUIRED) if (!(f in p)) errs.push(`missing "${f}"`);
  if (p.key) {
    for (const f of KEY_FIELDS) if (!(f in p.key)) errs.push(`missing key.${f}`);
    for (const f of NUMERIC_KEYS) if (p.key[f] != null && typeof p.key[f] !== 'number') errs.push(`key.${f} must be a number`);
  }
  for (const f of ['priceUSD', 'pricePKR']) if (p[f] != null && typeof p[f] !== 'number') errs.push(`${f} must be a number`);
  if (p.announced && !/^\d{4}-\d{2}-\d{2}$/.test(p.announced)) errs.push('announced must be YYYY-MM-DD');
  if (p.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errs.push('id must be lowercase kebab-case');
  if (p.brand && !BRANDS.includes(p.brand)) errs.push(`brand must be one of: ${BRANDS.join(', ')}`);
  if (p.status && !STATUSES.includes(p.status)) errs.push(`status must be one of: ${STATUSES.join(', ')}`);
  if (p.specs && (typeof p.specs !== 'object' || Array.isArray(p.specs))) errs.push('specs must be an object of sections');
  for (const [section, rows] of Object.entries(p.specs || {})) {
    for (const [k, v] of Object.entries(rows || {})) if (v != null && typeof v !== 'string') errs.push(`specs.${section}.${k} must be a string or null`);
  }
  if (!['official', 'spec-database'].includes(p.verified)) errs.push('verified must be "official" or "spec-database"');
  if (!Array.isArray(p.sources) || !p.sources.length) errs.push('needs at least one source URL');
  return errs.map((e) => `${file} › ${p.id ?? '(no id)'}: ${e}`);
}

const files = (await readdir(srcDir)).filter((f) => f.endsWith('.json')).sort();
const phones = [];
const errors = [];
const seen = new Set();

for (const file of files) {
  const list = JSON.parse(await readFile(join(srcDir, file), 'utf8'));
  for (const p of list) {
    errors.push(...validate(p, file));
    if (seen.has(p.id)) errors.push(`${file} › ${p.id}: duplicate id`);
    seen.add(p.id);
    phones.push(p);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}

if (checkOnly) {
  console.log(`✓ ${phones.length} phones from ${files.length} file(s) are valid (not written: --check)`);
  process.exit(0);
}

// Official renders win; data/images/web only fills phones whose maker has none.
const imageSources = new Map();
for (const dir of [join(root, 'data', 'images', 'web'), imageManifestDir]) {
  try {
    for (const f of (await readdir(dir)).filter((n) => n.endsWith('.json'))) {
      for (const [id, entry] of Object.entries(JSON.parse(await readFile(join(dir, f), 'utf8')))) imageSources.set(id, entry.page);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Phones without a Pakistan price get an approximate PKR figure converted from their official launch price.
const readJSON = async (f) => JSON.parse(await readFile(join(root, 'data', f), 'utf8'));
const launchPrices = await readJSON('launch-prices.json').catch(() => ({}));
const fx = await readJSON('fx.json').catch(() => null);
const roundTo = (v, step) => Math.round(v / step) * step;
let approxCount = 0;
for (const p of phones) {
  delete p.launchPrice;
  delete p.approx;
  const lp = launchPrices[p.id];
  if (lp) p.launchPrice = { amount: lp.amount, currency: lp.currency, market: lp.market };
  if (p.pricePKR != null || !fx) continue;
  const from = p.priceUSD != null ? { amount: p.priceUSD, currency: 'USD' } : p.launchPrice;
  const rate = from && fx.pkrPer[from.currency];
  if (!rate) continue;
  const pkr = from.amount * rate;
  p.approx = { pkr: roundTo(pkr, 500), usd: Math.round(pkr / fx.pkrPer.USD), from: `${from.currency} ${from.amount.toLocaleString('en-US')}` };
  approxCount++;
}

let withImage = 0;
for (const p of phones) {
  const rel = `img/phones/${p.id}.webp`;
  const hasFile = imageSources.has(p.id) && await access(join(root, rel)).then(() => true, () => false);
  delete p.image;
  delete p.imageCredit;
  if (!hasFile) continue;
  p.image = rel;
  const src = imageSources.get(p.id);
  if (src) p.imageCredit = new URL(src).hostname.replace(/^www\./, '');
  withImage++;
}

phones.sort((a, b) => b.announced.localeCompare(a.announced) || a.id.localeCompare(b.id));
const updated = new Date().toISOString().slice(0, 10);
await writeFile(outFile, JSON.stringify({ updated, fx: fx && { date: fx.date, pkrPer: fx.pkrPer }, phones }, null, 2) + '\n');
const unpriced = phones.filter((p) => p.pricePKR == null && !p.approx).map((p) => p.id);
console.log(`✓ ${phones.length} phones (${withImage} with images, ${approxCount} with converted prices) from ${files.length} file(s) → data/phones.json (updated ${updated})`);
if (unpriced.length) console.log(`! no price at all: ${unpriced.join(', ')}`);
