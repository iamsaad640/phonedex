import { store } from '../store.js';
import { app, icon, setTitle, fmtDate } from '../ui.js';

const FAQ = [
  ['Where do the specs come from?', 'From the manufacturer’s official spec sheet wherever one is published. Those phones carry an “Official specs” badge. The rest come from established third-party spec databases and are marked “Spec database”. Every phone page links its sources.'],
  ['How current are the prices?', () => `Pakistan prices are retail prices from priceoye.pk, last checked on ${fmtDate(store.updated)}. Shop prices change often, so always confirm with the seller. USD prices are the official launch price.`],
  ['Why does a phone say “Not sold in Pakistan yet”?', 'It isn’t listed by Pakistani retailers yet, usually because it launched only in China or another region. We show the official launch price instead and never present a converted price as a Pakistan price.'],
  ['Why is battery or RAM missing on some iPhones?', 'Apple doesn’t publish battery capacity or RAM on its spec pages, and we only list figures we can confirm. Those phones are left out of the battery chart.'],
  ['How do I compare phones?', 'Tap “Compare” on up to three phones, then open the compare tray at the bottom of the screen. The better number in each row gets a green tick, and rows that differ are highlighted.'],
  ['Where are my liked phones saved?', 'In this browser on this device only. Nothing is uploaded, and clearing your browser data removes them.'],
  ['Does PhoneDex sell phones?', 'No. PhoneDex is an independent spec and price guide. We don’t take orders or payments. Buy from a retailer you trust and check the PTA status before you pay.'],
  ['Who runs PhoneDex?', 'M. Sufyan Mughal, Founder & CEO of PhoneDex.'],
  ['Is the assistant always right?', 'It answers from the same verified data you see on the site and says so when something isn’t in our database. For anything important, double-check the phone page and its sources.'],
];

export function render() {
  setTitle('Support');
  app.innerHTML = `
    <header class="page-head reveal">
      <span class="eyebrow">${icon('help')}Support</span>
      <h1>How can we help?</h1>
      <p>Quick answers below. For anything else, the assistant replies in seconds, in English or Urdu.</p>
    </header>
    <div class="support-grid">
      <div class="faq">
        ${FAQ.map(([q, a], i) => `
          <details class="glass reveal" style="--i:${i}">
            <summary>${q}${icon('chevD')}</summary>
            <p>${typeof a === 'function' ? a() : a}</p>
          </details>`).join('')}
      </div>
      <aside class="side">
        <div class="assist-cta glass reveal" style="margin-top:0;flex-direction:column;align-items:flex-start;--i:2">
          <div class="orb">${icon('sparkle')}</div>
          <div>
            <h2>Chat with the assistant</h2>
            <p>Recommendations for your budget, spec questions, comparisons, and help using the site.</p>
          </div>
          <button class="btn primary" style="margin-left:0" data-open-chat>${icon('chat')}Start a chat</button>
        </div>
        <div class="panel glass reveal" style="--i:3">
          <h3>How we keep data honest</h3>
          <ul>
            <li>Every spec has a source link on its phone page.</li>
            <li>Unconfirmed values are left blank rather than guessed.</li>
            <li>Rankings use spec sheet numbers only, never paid placement.</li>
          </ul>
        </div>
      </aside>
    </div>`;
}
