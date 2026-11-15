import { esc, icon, thumb, fullName, priceInfo } from './ui.js';
import { store } from './store.js';
import { localAnswer, followUps } from './assistant.js';

const STORAGE_KEY = 'pd.chat';
const MAX_HISTORY = 24;
const SUGGESTIONS = [
  'Best gaming phone under 100k',
  'Compare Galaxy S26 Ultra vs iPhone 18 Pro Max',
  'Biggest battery under 60k',
  'Who is the founder of PhoneDex?',
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const fab = document.getElementById('chatFab');
const panel = document.getElementById('chatPanel');
let log, form, input, sendBtn, statusEl, suggestEl;

let messages = load();
let mode = 'unknown'; // 'ai' | 'local'
let busy = false;
let controller = null;

function load() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY))); } catch { /* storage unavailable */ }
}

/* ---------- safe markdown subset ---------- */
function inline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(((?:#\/|https:\/\/)[^)\s]+)\)/g, (_, text, url) => (url.startsWith('#/')
      ? `<a href="${url}" data-chat-link>${text}</a>`
      : `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`));
}
export function md(text) {
  let html = '';
  let list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of esc(text).split('\n')) {
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      close();
      if (!line.trim()) continue;
      const h = line.match(/^#{1,6}\s+(.*)/);
      html += h ? `<p><strong>${inline(h[1])}</strong></p>` : `<p>${inline(line)}</p>`;
    }
  }
  close();
  return html;
}

/* ---------- rendering ---------- */
function bubble(role, html, extra = '') {
  const el = document.createElement('div');
  el.className = `msg ${role === 'user' ? 'user' : 'bot'} ${extra}`;
  el.innerHTML = html;
  log.appendChild(el);
  scrollDown();
  return el;
}
const typingHTML = '<span class="typing" aria-label="Assistant is typing"><span></span><span></span><span></span></span>';
const scrollDown = () => { log.scrollTop = log.scrollHeight; };

// Picture cards for the phones an answer links to, like a shop's product strip.
function cardsHTML(text) {
  const ids = [...new Set([...text.matchAll(/\(#\/phone\/([a-z0-9-]+)\)/g)].map((m) => m[1]))];
  const phones = ids.map((id) => store.byId.get(id)).filter(Boolean).slice(0, 4);
  if (!phones.length) return '';
  return `<div class="chat-cards">${phones.map((p) => `
    <a class="chat-card" href="#/phone/${esc(p.id)}" data-chat-link>
      ${thumb(p, 'md')}
      <span>${esc(fullName(p))}<small>${priceInfo(p, 'PKR').value}</small></span>
    </a>`).join('')}</div>`;
}
const botHTML = (text, note = '') => `${md(text)}${note ? `<span class="note">${esc(note)}</span>` : ''}${cardsHTML(text)}`;

function setSuggestions(list) {
  suggestEl.innerHTML = list.map((s) => `<button type="button">${esc(s)}</button>`).join('');
  suggestEl.hidden = !list.length;
}

function renderLog() {
  log.innerHTML = '';
  bubble('bot', md("Hi! I'm the **PhoneDex Assistant**. Ask me for a recommendation, a spec, a price or a comparison, in English, Urdu or Roman Urdu."));
  for (const m of messages) bubble(m.role, m.role === 'user' ? `<p>${esc(m.content)}</p>` : botHTML(m.content));
  const last = messages.at(-1);
  setSuggestions(last?.role === 'assistant' ? followUps(last.content) : SUGGESTIONS);
}

// Reveals an instant answer word by word so it reads like it is being written.
async function typeOut(el, text) {
  if (reducedMotion.matches) { el.innerHTML = botHTML(text); return; }
  const words = text.split(/(\s+)/);
  const step = Math.max(1, Math.ceil(words.length / 40));
  for (let i = step; i < words.length; i += step) {
    el.innerHTML = md(words.slice(0, i).join(''));
    scrollDown();
    await new Promise((r) => setTimeout(r, 16));
  }
  el.innerHTML = botHTML(text);
}

function setStatus() {
  const ai = mode === 'ai';
  statusEl.textContent = mode === 'unknown' ? 'Connecting…' : ai ? 'AI assistant · online' : 'Instant answers from PhoneDex data';
  statusEl.style.setProperty('--dot', ai ? '#2ee59d' : '#ffb547');
}

async function ensureMode() {
  if (mode !== 'unknown') return;
  try {
    const res = await fetch('api/health', { cache: 'no-store' });
    const data = res.ok ? await res.json() : null;
    mode = data?.ai ? 'ai' : 'local';
  } catch {
    mode = 'local';
  }
  setStatus();
}

/* ---------- sending ---------- */
function historyForServer() {
  let h = messages.slice(-MAX_HISTORY);
  while (h.length && h[0].role !== 'user') h = h.slice(1);
  return h;
}

async function streamAI(el) {
  controller = new AbortController();
  const phoneId = location.hash.startsWith('#/phone/') ? decodeURIComponent(location.hash.slice(8).split('?')[0]) : undefined;
  const res = await fetch('api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: historyForServer(), context: { phoneId } }),
    signal: controller.signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  }

  let text = '';
  let frame = 0;
  const paint = () => { frame = 0; el.innerHTML = md(text); scrollDown(); };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, cut).split('\n').find((l) => l.startsWith('data: '));
      buf = buf.slice(cut + 2);
      if (!line) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.error) throw Object.assign(new Error(ev.error), { status: 502, partial: text });
      if (ev.reset) text = '';
      if (ev.text) {
        text += ev.text;
        if (!frame) frame = requestAnimationFrame(paint);
      }
    }
  }
  if (frame) cancelAnimationFrame(frame);
  paint();
  if (!text.trim()) throw Object.assign(new Error('Empty reply'), { status: 502 });
  return text;
}

async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  busy = true;
  sendBtn.disabled = true;
  suggestEl.hidden = true;
  const history = messages.slice();
  messages.push({ role: 'user', content: text.slice(0, 2000) });
  bubble('user', `<p>${esc(text)}</p>`);
  input.value = '';
  autosize();
  const el = bubble('bot', typingHTML);

  await ensureMode();
  let reply;
  if (mode === 'ai') {
    try {
      reply = await streamAI(el);
    } catch (err) {
      if (err.name === 'AbortError') { busy = false; sendBtn.disabled = false; return; }
      if (err.status === 503) { mode = 'local'; setStatus(); }
      if (err.partial) {
        reply = err.partial;
        el.innerHTML = botHTML(reply, err.message);
      } else {
        reply = localAnswer(text, history);
        el.innerHTML = botHTML(reply, 'The AI assistant is unavailable right now, so this answer comes straight from PhoneDex data.');
      }
    }
    if (el.querySelector('.chat-cards') == null && cardsHTML(reply)) el.insertAdjacentHTML('beforeend', cardsHTML(reply));
  } else {
    await new Promise((r) => setTimeout(r, 320));
    reply = localAnswer(text, history);
    await typeOut(el, reply);
  }
  scrollDown();
  messages.push({ role: 'assistant', content: reply });
  setSuggestions(followUps(reply));
  save();
  busy = false;
  sendBtn.disabled = !input.value.trim();
  controller = null;
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

/* ---------- open / close ---------- */
export function openChat(prompt) {
  if (panel.hidden) {
    panel.classList.remove('closing');
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    fab.innerHTML = icon('x');
    ensureMode();
    scrollDown();
  }
  if (prompt) {
    input.value = prompt;
    autosize();
    sendBtn.disabled = false;
  }
  setTimeout(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 60);
}

export function closeChat() {
  if (panel.hidden) return;
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = `${icon('sparkle')}<span class="ping"></span>`;
  panel.classList.add('closing');
  panel.addEventListener('animationend', () => { panel.hidden = true; panel.classList.remove('closing'); }, { once: true });
}

function reset() {
  controller?.abort();
  messages = [];
  save();
  busy = false;
  renderLog();
  input.focus();
}

export function initChat() {
  fab.innerHTML = `${icon('sparkle')}<span class="ping"></span>`;
  panel.innerHTML = `
    <div class="chat-head">
      <span class="chat-avatar">${icon('sparkle')}</span>
      <div class="chat-title"><b>PhoneDex Assistant</b><small id="chatStatus">Connecting…</small></div>
      <button class="icon-btn" id="chatReset" aria-label="Start a new chat" title="New chat">${icon('refresh')}</button>
      <button class="icon-btn" id="chatClose" aria-label="Close chat">${icon('x')}</button>
    </div>
    <div class="chat-log" id="chatLog" aria-live="polite"></div>
    <div class="chat-suggest" id="chatSuggest"></div>
    <form class="chat-form" id="chatForm">
      <textarea id="chatInput" rows="1" placeholder="Ask about any phone…" aria-label="Message" maxlength="2000"></textarea>
      <button type="submit" id="chatSend" aria-label="Send" disabled>${icon('send')}</button>
    </form>
    <div class="chat-foot">Answers use PhoneDex data. Double-check before you buy.</div>`;

  log = panel.querySelector('#chatLog');
  form = panel.querySelector('#chatForm');
  input = panel.querySelector('#chatInput');
  sendBtn = panel.querySelector('#chatSend');
  statusEl = panel.querySelector('#chatStatus');
  suggestEl = panel.querySelector('#chatSuggest');

  fab.addEventListener('click', () => (panel.hidden ? openChat() : closeChat()));
  panel.querySelector('#chatClose').addEventListener('click', closeChat);
  panel.querySelector('#chatReset').addEventListener('click', reset);
  suggestEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) send(b.textContent);
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener('input', () => { autosize(); sendBtn.disabled = busy || !input.value.trim(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeChat(); fab.focus(); } });
  log.addEventListener('click', (e) => {
    if (e.target.closest('[data-chat-link]') && matchMedia('(max-width: 760px)').matches) closeChat();
  });

  renderLog();
  setStatus();
}
