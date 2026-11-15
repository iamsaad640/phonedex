// Downloads the official product renders listed in data/images/official/*.json and turns them into
// transparent WebP cut-outs in img/phones/<id>.webp. Needs ImageMagick (`magick`).
// Manifest entries: { "<phone id>": { "url": "<image url>", "page": "<brand product page it came from>" } }
// Usage: node scripts/build-images.mjs [--only id1,id2] [--force] [--prune]
//   --prune deletes images of phones that have no official entry.
import { readdir, readFile, writeFile, mkdir, access, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestDir = join(root, 'data', 'images', 'official');
// Used only for phones whose maker publishes no usable render; entries must be watermark-free.
const webDir = join(root, 'data', 'images', 'web');
const cacheDir = join(root, 'data', 'images', '.cache');

// Product pages must be on the maker's own domains; images may come from the maker's CDN.
export const OFFICIAL_SITES = {
  Apple: ['apple.com'],
  Samsung: ['samsung.com'],
  Google: ['store.google.com', 'blog.google', 'google.com'],
  Xiaomi: ['mi.com', 'xiaomi.com', 'po.co', 'redmi.com'],
  OnePlus: ['oneplus.com', 'oneplus.in', 'oneplus.net'],
  OPPO: ['oppo.com'],
  vivo: ['vivo.com', 'vivo.com.cn', 'vivoglobal.com'],
  realme: ['realme.com'],
  Honor: ['honor.com', 'hihonor.com'],
  Huawei: ['huawei.com', 'vmall.com'],
  Nothing: ['nothing.tech', 'cmf.tech'],
  Motorola: ['motorola.com', 'motorolaus.com', 'lenovo.com'],
  Tecno: ['tecno-mobile.com'],
  Infinix: ['infinixmobility.com'],
};
const hostOk = (url, domains) => {
  try {
    const h = new URL(url).hostname;
    return domains.some((d) => h === d || h.endsWith('.' + d));
  } catch { return false; }
};
const outDir = join(root, 'img', 'phones');

const args = process.argv.slice(2);
const force = args.includes('--force');
const prune = args.includes('--prune');
const onlyArg = args[args.indexOf('--only') + 1];
const only = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;

const BOX = 640;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const exists = (f) => access(f).then(() => true, () => false);

async function loadManifest() {
  const map = new Map();
  for (const [dir, official] of [[webDir, false], [manifestDir, true]]) {
    if (!(await exists(dir))) continue;
    for (const f of (await readdir(dir)).filter((n) => n.endsWith('.json')).sort()) {
      const entries = JSON.parse(await readFile(join(dir, f), 'utf8'));
      for (const [id, entry] of Object.entries(entries)) map.set(id, { ...entry, official });
    }
  }
  return map;
}

async function download(id, url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`not an image (${type})`);
  const file = join(cacheDir, `${id}.${type.split('/')[1].split(';')[0].replace('jpeg', 'jpg')}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Reads the four corner pixels to decide whether the backdrop is plain white or already transparent.
async function backdrop(file) {
  const { stdout } = await run('magick', [
    file + '[0]', '-alpha', 'set', '-format',
    '%[fx:p{0,0}.a] %[fx:p{0,0}.r] %[fx:p{0,0}.g] %[fx:p{0,0}.b] ' +
    '%[fx:p{w-1,0}.a] %[fx:p{w-1,0}.r] %[fx:p{w-1,0}.g] %[fx:p{w-1,0}.b] ' +
    '%[fx:p{0,h-1}.a] %[fx:p{0,h-1}.r] %[fx:p{0,h-1}.g] %[fx:p{0,h-1}.b] ' +
    '%[fx:p{w-1,h-1}.a] %[fx:p{w-1,h-1}.r] %[fx:p{w-1,h-1}.g] %[fx:p{w-1,h-1}.b]',
    'info:',
  ]);
  const v = stdout.trim().split(/\s+/).map(Number);
  const corners = [0, 4, 8, 12].map((i) => v.slice(i, i + 4));
  if (corners.every(([a]) => a < 0.05)) return 'transparent';
  if (corners.every(([a, r, g, b]) => a > 0.95 && Math.min(r, g, b) > 0.93)) return 'white';
  return 'other';
}

async function processOne(id, url) {
  const src = await download(id, url);
  const kind = await backdrop(src);
  const out = join(outDir, `${id}.webp`);
  const cut = kind === 'white'
    ? ['-bordercolor', 'white', '-border', '1', '-fuzz', '7%', '-fill', 'none', '-draw', 'color 0,0 floodfill', '-shave', '1x1']
    : [];
  await run('magick', [
    src + '[0]', '-alpha', 'set', ...cut, '-trim', '+repage',
    '-resize', `${BOX}x${BOX}>`, '-strip', '-quality', '82', '-define', 'webp:alpha-quality=90', out,
  ]);
  return kind;
}

const manifest = await loadManifest();
await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const brandOf = new Map();
for (const f of (await readdir(join(root, 'data', 'src'))).filter((n) => n.endsWith('.json'))) {
  for (const p of JSON.parse(await readFile(join(root, 'data', 'src', f), 'utf8'))) brandOf.set(p.id, p.brand);
}

const ids = [...manifest.keys()].filter((id) => !only || only.has(id));
let done = 0, skipped = 0;
const problems = [];
for (const id of ids) {
  const entry = manifest.get(id);
  const brand = brandOf.get(id);
  if (!brand) { problems.push(`${id}: unknown phone id`); continue; }
  if (!entry?.url || !entry?.page) { problems.push(`${id}: entry needs both "url" and "page"`); continue; }
  if (entry.official && !hostOk(entry.page, OFFICIAL_SITES[brand] || [])) { problems.push(`${id}: page ${entry.page} is not on ${brand}'s own website`); continue; }
  const out = join(outDir, `${id}.webp`);
  if (!force && (await exists(out))) { skipped++; continue; }
  try {
    const kind = await processOne(id, entry.url);
    done++;
    if (kind === 'other') problems.push(`${id}: backdrop is not plain white or transparent, kept as-is (pick a cleaner render)`);
  } catch (err) {
    problems.push(`${id}: ${err.message}`);
  }
}
if (only) for (const id of only) if (!manifest.has(id)) problems.push(`${id}: no entry in data/images/official/*.json`);

let pruned = 0;
if (prune) {
  for (const f of (await readdir(outDir)).filter((n) => n.endsWith('.webp'))) {
    if (!manifest.has(f.slice(0, -5))) { await unlink(join(outDir, f)); pruned++; }
  }
}

console.log(`✓ ${done} processed, ${skipped} already present${prune ? `, ${pruned} pruned` : ''} → img/phones/`);
if (problems.length) {
  console.log(`! ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exitCode = 1;
}
