# PhoneDex

Smartphone specs, Pakistan retail prices, side-by-side comparisons and an AI support assistant. Founded by **M. Sufyan Mughal** (Founder & CEO).

The UI is a dark-only "midnight glass" design:
- navy base with electric cyan to violet accents, frosted glass surfaces and the Geist typeface
- PriceOye-style product renders on every card
- scroll-reveal motion
- a card-to-detail image morph using the View Transitions API

## Run

```bash
npm install
npm run dev                    # http://localhost:3000, restarts on file changes, reads .env if present
npm start                      # same without auto-restart
```

Enable the AI assistant by putting `ANTHROPIC_API_KEY=sk-ant-...` in `.env` (git-ignored), then run `npm run dev`.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Turns the AI assistant on. The key stays on the server and is never sent to the browser. |
| `ASSISTANT_MODEL` | `claude-opus-5-5` | Claude model used for chat. |
| `ASSISTANT_EFFORT` | `low` | Reasoning effort: `low` / `medium` / `high`. Low keeps replies fast. |
| `PORT` | `3000` | Server port. |

Without a key, the assistant still works. It switches to built-in instant answers computed from the phone database (budgets, rankings, comparisons, spec lookups, FAQs). The same thing happens if the site is hosted as plain static files.

## How the assistant works

- `POST /api/chat` streams Claude's reply to the browser as Server-Sent Events.
- The whole catalog is sent in the system prompt with prompt caching, so repeat questions are cheap. The bot answers only from that data and says so when something isn't listed.
- If the visitor is on a phone page, the server tells the model which phone they're looking at.
- Server-side fallbacks (`fallbacks: "default"`) are enabled. A refused request is retried on Anthropic's recommended fallback model; if it's still refused, the visitor gets a polite decline.
- Guard rails:
  - 20 messages per minute per IP
  - 24-message history limit
  - 2,000 characters per message
  - 32 KB body limit
  - strict alternating user/assistant roles
- The browser renders replies with a small, safe markdown subset (bold, lists, and links that go only to site pages or `https://`).

## Pages

| Route | Page |
|---|---|
| `#/` | Featured carousel, search, latest launches, budgets, top charts, brands |
| `#/phones` | Full catalog: search, brand chips, price cap, sorting (state kept in the URL) |
| `#/phone/<id>` | Spec sheet, prices, like/compare, "ask about this phone", sources, similar phones |
| `#/compare?ids=a,b,c` | Up to 3 phones, best value marked, differences highlighted |
| `#/brands`, `#/brand/<name>` | Brand directory and brand pages |
| `#/rankings?by=battery` | Top charts by battery, camera MP, charging, display, refresh rate, weight |
| `#/prices?range=…` | Pakistan prices grouped by budget, plus phones not sold in Pakistan |
| `#/liked` | Hearted phones (saved in this browser) |
| `#/support` | FAQ and assistant entry point |

## Project layout

```
index.html            page shell (top bar, dock, chat, footer)
css/styles.css        design system
js/main.js            router, global events, theme
js/store.js           data loading, compare/like/currency state
js/ui.js              shared helpers, icons, phone card, toasts
js/carousel.js        featured carousel
js/chat.js            chat widget (streaming + markdown)
js/assistant.js       offline answer engine
js/pages/*.js         one module per page
server.mjs            static server + /api/chat
data/src/*.json       phone data (source of truth)
data/phones.json      generated: npm run build:data
scripts/build-data.mjs  validates and merges data/src
```

## Data

Edit `data/src/*.json`, then run `npm run build:data`. The build checks every entry and refuses to write if any field is invalid (`--check` validates without writing).

Phone pictures:
- `data/images/*.json` maps each phone id to a product-render URL, preferably PriceOye's `og:image`.
- `npm run build:images` downloads each render, cuts out the white background with ImageMagick and saves a transparent WebP to `img/phones/<id>.webp`.
- Run `npm run build:data` afterwards so phones pick up their `image`.
- The renders belong to their manufacturers or retailers. Check your rights to use them before deploying publicly.

The rest of the data rules:

- Use `null` for anything you can't confirm.
- `verified: "official"` means the specs were checked against the manufacturer's spec sheet.
- `pricePKR` is the priceoye.pk retail price; use `null` if the phone isn't sold in Pakistan.
- `priceUSD` is the official launch price.
