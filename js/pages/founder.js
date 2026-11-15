import { app, icon, setTitle } from '../ui.js';

export function render() {
  setTitle('Founder');
  app.innerHTML = `
    <section class="founder-page">
      <div class="founder-card glass reveal">
        <div class="founder-avatar has-photo"><img src="img/founder/sufyan.webp" alt="M. Sufyan Mughal" width="480" height="480" decoding="async" fetchpriority="high"></div>
        <span class="eyebrow">Founder &amp; CEO</span>
        <h1>M. Sufyan Mughal</h1>
        <p class="role">Founder &amp; CEO, PhoneDex</p>
        <div class="founder-actions">
          <a class="btn primary" href="#/phones">${icon('grid')}Explore phones</a>
          <a class="btn" href="#/support">${icon('help')}Support</a>
        </div>
      </div>
    </section>`;
}
