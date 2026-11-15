import { store } from './store.js';
import { app, esc, fullName, num, icon, thumb, brandColors, cardPrice, compareBtn } from './ui.js';

// Slide copy is built from each phone's data so the banner can't drift from the spec sheet.
const FEATURED = [
  { id: 'apple-iphone-18-pro-max', eyebrow: 'Just launched', line: (p) => `${p.key.chip} with a 48MP camera that has a variable aperture.` },
  { id: 'samsung-galaxy-s26-ultra', eyebrow: 'Camera king', line: () => '200MP main camera, 5x periscope zoom and a built-in Privacy Display.' },
  { id: 'google-pixel-11-pro', eyebrow: 'New Pixel', line: (p) => `${p.key.chip} running ${p.key.os}, in a compact ${p.key.displayIn}″ body.` },
  { id: 'samsung-galaxy-a57-5g', eyebrow: 'Mid-range pick', line: (p) => `${p.key.displayIn}″ ${p.key.refreshHz}Hz AMOLED and a ${num(p.key.batteryMah)} mAh battery.` },
];
const SLIDE_MS = 5500;

export function carouselHTML() {
  const slides = FEATURED.map((f) => ({ ...f, p: store.byId.get(f.id) })).filter((s) => s.p);
  if (!slides.length) return '';
  return `
    <section class="carousel reveal" aria-roledescription="carousel" aria-label="Featured phones" style="--slide-ms:${SLIDE_MS}ms">
      <div class="carousel-track">${slides.map((s, i) => slideHTML(s, i, slides.length)).join('')}</div>
      <button class="car-arrow prev" aria-label="Previous slide">${icon('chevL')}</button>
      <button class="car-arrow next" aria-label="Next slide">${icon('chevR')}</button>
      <div class="car-dots" role="tablist" aria-label="Choose slide">
        ${slides.map((s, i) => `<button class="car-dot" role="tab" data-go="${i}" aria-label="${esc(fullName(s.p))}"></button>`).join('')}
      </div>
      <div class="car-progress"></div>
    </section>`;
}

function slideHTML({ p, eyebrow, line }, i, total) {
  const [c1, c2] = brandColors(p.brand);
  const k = p.key;
  const chips = [
    k.displayIn && ['display', `${k.displayIn}″ ${k.refreshHz ? k.refreshHz + 'Hz' : ''}`.trim()],
    k.mainCamMP && ['camera', `${k.mainCamMP}MP`],
    k.batteryMah && ['battery', `${num(k.batteryMah)} mAh`],
    k.chargingW && ['bolt', `${k.chargingW}W`],
  ].filter(Boolean);
  return `
    <article class="slide" style="--c1:${c1};--c2:${c2}" aria-roledescription="slide" aria-label="${i + 1} of ${total}">
      <div class="slide-copy">
        <span class="slide-eyebrow">${icon('sparkle')}${esc(eyebrow)}</span>
        <h2>${esc(fullName(p))}</h2>
        <p>${esc(line(p))}</p>
        <ul class="slide-specs">${chips.map(([ic, c]) => `<li>${icon(ic)}${esc(c)}</li>`).join('')}</ul>
        <div class="slide-cta">
          <a class="btn primary" href="#/phone/${esc(p.id)}">View full specs ${icon('arrowR')}</a>
          ${compareBtn(p)}
          <span class="slide-price">${cardPrice(p)}</span>
        </div>
      </div>
      <a class="slide-art" href="#/phone/${esc(p.id)}" tabindex="-1" aria-hidden="true" draggable="false"><span class="orbit"></span>${thumb(p, 'xl', { eager: i === 0 })}</a>
    </article>`;
}

// Returns a cleanup function that stops autoplay.
export function initCarousel() {
  const root = app.querySelector('.carousel');
  if (!root) return () => {};
  const track = root.querySelector('.carousel-track');
  const progress = root.querySelector('.car-progress');
  const slides = [...track.children];
  const dots = [...root.querySelectorAll('.car-dot')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let timer = null;

  const restartProgress = (running) => {
    progress.classList.remove('run');
    if (!running) return;
    void progress.offsetWidth;
    progress.classList.add('run');
  };
  const go = (i) => {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, j) => { s.inert = j !== index; });
    dots.forEach((d, j) => d.setAttribute('aria-selected', String(j === index)));
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
    restartProgress(false);
  };
  const start = () => {
    if (reduced || slides.length < 2 || !root.offsetParent) return;
    stop();
    restartProgress(true);
    timer = setInterval(() => { go(index + 1); restartProgress(true); }, SLIDE_MS);
  };
  const jump = (i) => { go(i); start(); };

  root.querySelector('.prev').addEventListener('click', () => jump(index - 1));
  root.querySelector('.next').addEventListener('click', () => jump(index + 1));
  dots.forEach((d) => d.addEventListener('click', () => jump(Number(d.dataset.go))));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') jump(index - 1);
    if (e.key === 'ArrowRight') jump(index + 1);
  });
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);
  root.addEventListener('focusin', stop);
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) start(); });

  // The track follows the finger/mouse while dragging, then settles on the nearest slide.
  let startX = null;
  let dx = 0;
  let suppressClick = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, .btn')) return;
    startX = e.clientX;
    dx = 0;
  });
  track.addEventListener('pointermove', (e) => {
    if (startX == null) return;
    dx = e.clientX - startX;
    if (Math.abs(dx) < 6) return;
    if (!track.classList.contains('dragging')) {
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
      stop();
    }
    const edge = (index === 0 && dx > 0) || (index === slides.length - 1 && dx < 0) ? 0.35 : 1;
    track.style.transform = `translate3d(calc(${-index * 100}% + ${dx * edge}px), 0, 0)`;
  });
  const endDrag = () => {
    if (startX == null) return;
    const dragged = track.classList.contains('dragging');
    track.classList.remove('dragging');
    startX = null;
    if (!dragged) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 80);
    const threshold = Math.min(90, track.clientWidth * 0.12);
    jump(Math.abs(dx) > threshold ? index + (dx < 0 ? 1 : -1) : index);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  go(0);
  start();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
