// PhoneDex server: static files + /api/chat (streams Claude replies as SSE).
// Usage: ANTHROPIC_API_KEY=... npm start   (or: node --env-file=.env server.mjs)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.ASSISTANT_EFFORT || 'low';
const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = AI_ENABLED ? new Anthropic() : null;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 2000;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
const PRIVATE_PREFIXES = ['/node_modules', '/scripts', '/server.mjs', '/package', '/README'];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const SYSTEM_INSTRUCTIONS = `You are the PhoneDex Assistant, the support chatbot on PhoneDex, a website that lists smartphone specs, Pakistan retail prices (PKR) and official launch prices (USD), with side-by-side comparison. PhoneDex was founded by M. Sufyan Mughal, its Founder & CEO; mention this when someone asks who founded, owns or runs the site, and don't invent other details about the founder.

What you help with:
- Recommending phones from the catalog for a user's budget and priorities.
- Answering spec and price questions about catalog phones, and comparing them.
- Explaining the website. Pages: Home (#/), All phones (#/phones), a phone (#/phone/<id>), Compare (#/compare?ids=<id>,<id>,<id>), Brands (#/brands), Top charts (#/rankings), Prices by budget (#/prices), Liked phones (#/liked), Support (#/support). Users save phones with the heart button and can compare up to 3 phones.

Ground rules:
- The catalog below is your only source for specs and prices. Quote figures exactly as written. If a value is null or a phone isn't in the catalog, say PhoneDex doesn't have it yet instead of estimating. You may mention widely known facts about phones outside the catalog only if you say clearly that they are not from PhoneDex data and may be outdated.
- pricePKR is the retail price on priceoye.pk on the "data last checked" date; it changes often. pricePKR null means the phone isn't sold in Pakistan yet. Never present a converted USD price as a Pakistan price.
- verified "official" means checked against the manufacturer's spec sheet; "spec-database" means a third-party spec site.
- Link every catalog phone you name, like [Samsung Galaxy S26 Ultra](#/phone/samsung-galaxy-s26-ultra). When comparing, also link the compare page with those ids.
- For recommendations, pick 1-3 phones and give one line each on why, based on the data. Match the use case: gaming = chipset class, refresh rate and RAM; camera = main sensor plus telephoto/ultrawide; battery life = capacity and charging speed. Respect the budget strictly and say if nothing fits.
- Treat follow-ups like "and its battery?" as being about the phone(s) discussed just before. Ask one short question first only when the budget or main priority is missing and the answer depends on it.
- Reply in the user's language (English, Urdu or Roman Urdu).
- Keep replies short and easy to scan: a sentence or two, then a few bullet points if useful. Use **bold** for key figures. No tables and no headings.
- You can't place orders, check stock, take payments or contact sellers. For shop-specific questions, warranty or PTA approval, tell the user to confirm with the seller.
- Stay on phones, buying advice and this website; politely decline anything else.`;

let catalogCache = { mtimeMs: 0, text: '', byId: new Map() };

async function getCatalog() {
  const file = join(ROOT, 'data', 'phones.json');
  const { mtimeMs } = await stat(file);
  if (mtimeMs !== catalogCache.mtimeMs) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    const lines = data.phones.map((p) => JSON.stringify({
      id: p.id,
      name: `${p.brand} ${p.name}`,
      announced: p.announced,
      status: p.status,
      pricePKR: p.pricePKR,
      priceUSD: p.priceUSD,
      verified: p.verified,
      specs: p.specs,
    }));
    catalogCache = {
      mtimeMs,
      text: `Data last checked: ${data.updated}\n${lines.join('\n')}`,
      byId: new Map(data.phones.map((p) => [p.id, p])),
    };
  }
  return catalogCache;
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now > e.reset) hits.delete(ip);
}, RATE_LIMIT.windowMs).unref();

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return 'messages must be a non-empty array of at most 24 items';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (!m || m.role !== expected) return 'messages must alternate user/assistant, starting with user';
    if (typeof m.content !== 'string' || !m.content.trim() || m.content.length > MAX_MESSAGE_CHARS) return `each message must be 1-${MAX_MESSAGE_CHARS} characters`;
  }
  if (messages.at(-1).role !== 'user') return 'last message must be from the user';
  return null;
}

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return { status: 503, message: 'The AI assistant is not configured correctly.' };
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: 'The assistant is busy right now. Please try again in a moment.' };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, message: 'Could not reach the AI service.' };
  if (err instanceof Anthropic.APIError) return { status: 502, message: 'The AI service returned an error.' };
  return { status: 500, message: 'Something went wrong.' };
}

async function handleChat(req, res) {
  if (!AI_ENABLED) return sendJSON(res, 503, { error: 'AI assistant is not configured on this server.' });
  const ip = req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) return sendJSON(res, 429, { error: 'Too many messages. Please wait a minute.' });

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendJSON(res, err.status || 400, { error: err.status ? err.message : 'Invalid JSON' });
  }
  const invalid = validateMessages(body?.messages);
  if (invalid) return sendJSON(res, 400, { error: invalid });

  const catalog = await getCatalog();
  const messages = body.messages.map((m) => ({ role: m.role, content: m.content }));
  const viewing = typeof body.context?.phoneId === 'string' && catalog.byId.get(body.context.phoneId);
  if (viewing) {
    messages.push({ role: 'system', content: `The user is on the page for ${viewing.brand} ${viewing.name} (id: ${viewing.id}).` });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    ...SECURITY_HEADERS,
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    output_config: { effort: EFFORT },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{
      type: 'text',
      text: `${SYSTEM_INSTRUCTIONS}\n\n<catalog>\n${catalog.text}\n</catalog>`,
      cache_control: { type: 'ephemeral' },
    }],
    messages,
  });
  // req 'close' fires once the body is read; res 'close' is the real disconnect signal.
  res.on('close', () => { if (!res.writableEnded) stream.abort(); });

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') send({ text: event.delta.text });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      send({ reset: true, text: "Sorry, I can't help with that. I'm happy to answer questions about phones, specs and prices." });
    }
    send({ done: true });
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return;
    console.error('[chat]', err?.status ?? '', err?.message);
    send({ error: friendlyError(err).message });
  }
  res.end();
}

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = normalize(decodeURIComponent(pathname));
  } catch {
    return sendJSON(res, 400, { error: 'Bad path' });
  }
  if (rel === '/' || rel === sep) rel = '/index.html';
  const isHidden = rel.split(/[\\/]/).some((part) => part.startsWith('.'));
  const isPrivate = PRIVATE_PREFIXES.some((p) => rel.startsWith(p));
  const type = MIME[extname(rel).toLowerCase()];
  const file = join(ROOT, rel);
  if (isHidden || isPrivate || !type || !file.startsWith(ROOT + sep)) return sendJSON(res, 404, { error: 'Not found' });

  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    sendJSON(res, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/health' && req.method === 'GET') return sendJSON(res, 200, { ok: true, ai: AI_ENABLED });
    if (pathname === '/api/chat') {
      if (req.method !== 'POST') return sendJSON(res, 405, { error: 'Method not allowed' });
      return await handleChat(req, res);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'Method not allowed' });
    return await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Internal error' });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`PhoneDex running at http://localhost:${PORT}`);
  console.log(AI_ENABLED
    ? `AI assistant: on (${MODEL}, effort ${EFFORT})`
    : 'AI assistant: off — set ANTHROPIC_API_KEY to enable it. The site uses its built-in quick answers until then.');
});
