# ShopIQ: buy assistant for Amazon India

ShopIQ is a Chrome (Manifest V3) extension that adds a buying assistant to
Amazon India product pages. It reads the live page (price, rating histogram,
"Customers say" aspects, reviews), scores the product, and pulls 30-day price
history **and pros/cons** from Amazon's on-page AI assistant (Rufus). It also
shows a **seller trust scorecard**, lets you **browse review photos & videos**,
and surfaces retailer price comparisons plus Reddit/YouTube discussion, all in
a single in-page overlay.

> **No redirects.** Features that need data from another Amazon page (the
> seller scorecard at `/sp` and "Analyze more reviews" at `/product-reviews/…`)
> `fetch()` that page instead, same-origin and with the user's cookies, then
> parse the HTML in memory with `DOMParser`. The tab never navigates. Results
> are cached in `chrome.storage.local` (seller 24h, price history 12h).

> **Self-contained, no server required.** Review analysis and the retailer,
> Reddit, and YouTube scraping all run inside the extension's background
> service worker (`src/background/scraping/`). Cross-origin scraping works
> because the worker holds `host_permissions` for those domains, and a
> `declarativeNetRequest` ruleset (`public/dnr-rules.json`) sets each
> retailer's own `Referer`/`Origin` on the outgoing requests. There's no
> backend and no API key.

## Getting started

```bash
npm install        # install dependencies
npm run dev        # Vite dev server with HMR (loads from the dist/ build)
npm run build      # type-check (tsc --noEmit) then production build to dist/
```

Load the unpacked extension in Chrome: open `chrome://extensions`, enable
**Developer mode**, click **Load unpacked**, and select the `dist/` folder.
After a `npm run build`, hit the reload icon on the ShopIQ card to pick up
changes.

### Scripts

| Script                  | What it does                                     |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Vite dev server                                  |
| `npm run build`         | `tsc --noEmit` + Vite production build → `dist/` |
| `npm test`              | Run the Vitest suite once                        |
| `npm run test:watch`    | Vitest in watch mode                             |
| `npm run test:coverage` | Vitest with a V8 coverage report                 |
| `npm run lint`          | ESLint (flat config)                             |
| `npm run lint:fix`      | ESLint with autofix                              |
| `npm run format`        | Prettier write                                   |
| `npm run format:check`  | Prettier check                                   |

## Architecture

The extension has four execution contexts that talk over `chrome` messaging:

```
┌─────────────┐  SHOPIQ_* messages   ┌──────────────────────┐
│ content     │ ───────────────────► │ background (SW)      │
│ script      │ ◄─────────────────── │ router + state store │
│ (Amazon DOM)│   state / responses  │ + scraping/ + analyze│
└─────┬───────┘                      └──────────┬───────────┘
      │ mounts (shadow DOM)                     │ fetch (host_permissions)
      ▼                                         ▼
┌─────────────┐   SHOPIQ_GET_STATE   ┌──────────────────────┐
│ overlay     │ ───────────────────► │ Croma / Reliance /   │
│ (React UI)  │ ◄─────────────────── │ Ajio / Meesho /      │
└─────────────┘                      │ Myntra / Reddit / YT │
                                     └──────────────────────┘

┌─────────────┐   toolbar popup → settings (chrome.storage.local)
│ popup       │   + "Open ShopIQ" (SHOPIQ_SHOW_OVERLAY)
└─────────────┘
```

- **`src/content/`**: runs in the Amazon page. Scrapes product/review data
  including review photos & videos (`amazon.ts`), mounts the React overlay in a
  shadow DOM (`overlay-mount.tsx`), and handles sponsored cards
  (`remove-sponsored.ts`: cover / remove modes). The entry (`content.tsx`)
  re-runs on a debounced DOM-mutation observer and relays messages to the
  background.
- **`src/background/`**: the MV3 service worker. `background.ts` is a thin
  message router; each message is handled by a focused function in
  `handlers/*`. Per-tab product/UI/scan state lives in `state.ts` (in-memory
  Maps mirrored to `chrome.storage.session` so it survives SW restarts and page
  navigations). `api.ts` is the seam the handlers call; it runs the local
  heuristic analysis and the retailer/Reddit/YouTube scrapers in `scraping/`
  (ported from the old backend, using `fetch` + cheerio, cached in
  `chrome.storage.local`). Pure helpers in `lib/`.
- **`src/overlay/`**: the React UI injected into the page. `OverlayRoot` shows
  a launcher when closed and the tabbed `App` when open (Summary, Price History,
  Reviews, Social, Settings). The Summary tab carries the buy-score verdict,
  collapsible Pros/Cons, and a collapsible **Seller** scorecard; review photos/
  videos open in a centered detail overlay. Some `lib/` modules fetch + parse
  Amazon pages directly (`sellerRating.ts`, `reviewScan.ts`) and float on-page
  elements behind a dimmed scrim (`pageOverlay.ts`); the rest derive view-models
  from already-extracted data. Data comes from hooks (`hooks/`).
- **`src/popup/`**: the toolbar popup, with toggles (auto-open, sponsored-ad
  handling), an "Open ShopIQ" button, and a privacy policy link.
- **`src/shared/`**: the cross-context contract, covering the
  `ExtensionMessage` union and data types (`types.ts`), constants/URL patterns
  (`constants.ts`), the review-URL builder (`reviewUrl.ts`), thin messaging
  wrappers (`messaging.ts`), and pure formatters (`utils/`).

### Everything site-specific lives in config

> **Rule for contributors: never hardcode a third-party selector, URL, query
> param, or AI prompt inline in source.** Add it to
> `src/config/default-config.json`, type it in `src/config/types.ts`, and read it
> via `getConfig()`.

Every selector, URL, query-param, and page-specific string ShopIQ depends on,
including the PDP scrapers, review markup, the seller profile (`/sp`) parser,
the Rufus AI assistant controls (including the prompts sent to Rufus), the
review-photo gallery trigger, the on-page peek overlays, and the retailer /
Reddit / YouTube scrapers, is declared in `src/config/default-config.json`
(typed by `src/config/types.ts`). Nothing third-party is hardcoded in
component or lib code, so when a site changes its markup you fix it in one
JSON file instead of
hunting through the source.

`getConfig()` is a synchronous accessor that returns this bundled config, so the
launcher and overlay mount instantly and no `getConfig().…` access can throw.
`resolveByPath()` handles the dot-separated JSON paths a couple of configs use
(the YouTube results path, Myntra's state path).

### The review scan (no navigation)

"Analyze more reviews" crawls additional Amazon review pages **in place**: the
tab never leaves the product page. `useProductState.analyzeMoreReviews` calls
`overlay/lib/reviewScan.ts`, which `fetch()`es each `/product-reviews/…?pageNumber=N`
URL (built by `shared/reviewUrl.ts` from the chosen sort/star/verified/media
filters), parses it with `DOMParser`, and reuses the same extractor as the
on-page scrape (`extractReviewsFrom` in `content/amazon.ts`). It dedupes across
pages and stops early once a page yields nothing new (the end of the list, or
Amazon limiting signed-out results).

The scan's reviews populate **only** the Reviews tab's "Filtered reviews" list
(`scanResult`, held in the overlay's own state); they never merge into
`product.reviews`, so the Summary's verdict/score stay anchored to the product
page's own reviews. This decoupling is guarded by tests in
`src/overlay/components/reviews/ReviewsTab.test.tsx`.

### Load priority (keeping the AI fast)

Amazon's Rufus AI streams its answer on the page's main thread, which the overlay
shares. Several things keep it fast and unblocked:

- **Split prompts.** Price history and pros/cons are asked as two separate, short
  prompts (not one long one). Price history runs eagerly; pros/cons runs **only
  when the user expands that section** (`loadProsCons` / `useAssistantProsCons`).
  A shorter prompt makes Rufus answer faster, and most users never trigger the
  second round-trip. A mutex (`assistantLock`) serializes the two so they never
  fight over Rufus's single input.
- **Suppressed rendering + idle polling.** While Rufus streams, its response
  element is `content-visibility: hidden` (we read `textContent`, never paint it)
  and we poll on `requestIdleCallback`, so Rufus's own work gets the main thread.
- **Deferred heavy work.** Retailer-price and Reddit/YouTube scrapes wait until
  the price-history request settles (or a short cap elapses) before firing; see
  `heavyAllowed` in `App.tsx` and the `enabled` gate on `useComparisons`/
  `usePrices`. The seller scorecard is lazy-loaded only when its card first renders.

## Testing & quality

- **Vitest + Testing Library** (jsdom). Tests live next to the code they cover
  (`*.test.ts[x]`). A `chrome.*` mock is installed in `src/test/setup.ts`.
- Coverage focuses on pure logic (`insights`, `priceHistory` parsers,
  `buildReviewUrl`, `mergeProductReviews`, formatters), the `useProductState`
  hook, and critical components (the `ReviewsTab` decoupling guard, `SummaryTab`,
  `ReviewScanner`, `OverlayRoot` visibility).
- **ESLint** (flat config, `typescript-eslint` + react-hooks) and **Prettier**
  enforce consistency; ESLint stays out of formatting.

## Project layout

```
src/
├── background/        # MV3 service worker
│   ├── background.ts  #   thin message router
│   ├── state.ts       #   per-tab state (Maps + chrome.storage.session)
│   ├── api.ts         #   backend fetch calls
│   ├── handlers/      #   one module per message concern
│   └── lib/           #   pure helpers (mergeProductReviews)
├── config/            # bundled config + types (all site selectors/URLs/prompts)
├── content/           # Amazon page: scrapers, overlay mount, sponsored handling
├── overlay/           # React UI
│   ├── atoms/         #   presentational primitives
│   ├── components/    #   feature components, grouped by tab
│   ├── hooks/         #   data hooks (message the background / fetch in place)
│   └── lib/           #   view-models + in-place fetchers (seller, reviewScan)
├── popup/             # toolbar popup
├── shared/            # types, constants, reviewUrl, messaging, formatters
└── test/              # Vitest setup + chrome mock
```

The overlay deliberately uses an **atoms / components** split with no
intermediate "molecules" layer; feature complexity lives in the per-tab
component folders.

## Disclaimer

ShopIQ is an independent, unofficial project, not affiliated with, endorsed by,
or connected to Amazon or any other retailer named here. It reads and automates
pages in your own logged-in browser session, for personal use.

<img width="424" height="841" alt="Image" src="https://github.com/user-attachments/assets/33b16e92-8b3e-4ac3-9b6e-b7b4fcfbd669" />
<img width="442" height="862" alt="Image" src="https://github.com/user-attachments/assets/2755fc98-9b31-4920-b477-569b70fed9dd" />
<img width="1360" height="863" alt="Image" src="https://github.com/user-attachments/assets/5cf50054-5024-4c48-b5c2-cbb08b8f6459" />
<img width="1364" height="844" alt="Image" src="https://github.com/user-attachments/assets/2bf67cfb-6b80-4185-96e8-ab258472607c" />
<img width="1472" height="878" alt="Image" src="https://github.com/user-attachments/assets/b2254a37-e107-4e47-88f4-1e48c60db189" />
<img width="1429" height="861" alt="Image" src="https://github.com/user-attachments/assets/e599356a-4692-4bff-bf5f-66d492a3282f" />
<img width="428" height="859" alt="Image" src="https://github.com/user-attachments/assets/f920f91e-5773-4787-bba1-d8199c24d303" />
<img width="1355" height="831" alt="Image" src="https://github.com/user-attachments/assets/ad70702e-1062-4043-89e9-673a4d9e990e" />
<img width="443" height="855" alt="Image" src="https://github.com/user-attachments/assets/4350d99d-fd69-4b70-8111-487997d6bc13" />
<img width="458" height="866" alt="Image" src="https://github.com/user-attachments/assets/144ffde7-9994-4169-a270-4efbd7f24f54" />

