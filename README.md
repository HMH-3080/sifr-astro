# sifr — Astro

Marketing site for **sifr**, an independent engineering studio, rebuilt as a static
Astro project from the original single-file HTML design. The hero centres on an
enhanced WebGL scene that degrades gracefully to CSS.

Live preview while building: <http://localhost:4341>

---

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | [Astro](https://astro.build) 7 — static output, no client UI framework |
| Language   | TypeScript (strict)                                           |
| 3D         | [three.js](https://threejs.org) r169 — lazy, code-split       |
| Styling    | Plain CSS with custom properties (no Tailwind, no UI kit)      |
| Fonts      | Instrument Sans, JetBrains Mono, Alexandria (Google Fonts)     |

Requirements: **Node ≥ 22.23.4** (developed on Node 26), npm 10+.

---

## Quick start

```bash
cd Projects/sifr-astro
npm install
npm run dev        # http://localhost:4321
```

Open <http://localhost:4321>. The dev toolbar is disabled for a clean preview.

---

## Project structure

```
sifr-astro/
├── astro.config.mjs          Build + Vite config (site URL, code-split three.js)
├── package.json
├── public/
│   └── favicon.svg           Site icon
└── src/
    ├── components/           Page sections, one file each
    │   ├── Header.astro      Fixed glass nav, language toggle, mobile panel
    │   ├── Hero.astro        Headline + orb stage markup
    │   ├── Strip.astro       Three-item divider strip
    │   ├── Capabilities.astro
    │   ├── Statement.astro
    │   ├── Modernize.astro
    │   ├── Method.astro
    │   ├── Work.astro
    │   ├── Faq.astro         <details>/<summary> accordion
    │   ├── Contact.astro     Inquiry form (no backend by default)
    │   └── Footer.astro
    ├── config.ts             Site-wide config: URL, contact email/endpoint
    ├── i18n/
    │   └── translations.ts   Typed en + ar dictionaries
    ├── layouts/
    │   └── BaseLayout.astro  <head>, SEO meta, JSON-LD, fonts
    ├── pages/
    │   └── index.astro       Single page composed from components
    ├── scripts/
    │   ├── site.ts           Language, menu, scroll spy, tilt, form
    │   └── orb-scene.ts      WebGL hero scene
    └── styles/
        └── global.css        Design tokens + all component styles
```

---

## How it works

### Content and i18n

All copy lives in `src/i18n/translations.ts` as a typed `en` / `ar` dictionary pair.
Markup carries `data-i18n`, `data-i18n-placeholder` and `data-i18n-aria` attributes;
`src/scripts/site.ts` swaps text on toggle and persists the choice in
`localStorage`. Arabic switches `<html lang>` and `dir="rtl"`, and the CSS has
matching RTL rules for arrows, the scroll-progress bar, and the progress origin.

### Hero animation

`src/scripts/orb-scene.ts` renders the glass form with three.js:

- A glass torus that **assembles on entry** (scale + rotate ease-out).
- A breathing wireframe icosahedron core, counter-rotating inside the torus.
- **Two orbital rings, each with a satellite** that rides the ring.
- A drifting particle field and a **cursor-tracked light** that sweeps the glass.
- Pointer parallax on the whole assembly.

Performance and resilience:

- Module is **lazy-booted** only when the stage approaches the viewport.
- Loop **pauses** when the hero is off-screen or the tab is hidden.
- **Adaptive pixel ratio** drops resolution if frames run long.
- Falls back to the CSS-only orb when WebGL is missing, when the user prefers
  reduced motion, has `saveData` set, or reports ≤ 2 GB device memory.
- Recovers from WebGL context loss and restores the scene.

### Form

The inquiry form has no backend by default. Configure one of two delivery paths in
`src/config.ts`:

- `contactEmail` — opens the visitor's mail app with a prefilled message.
- `formEndpoint` — `POST`s `{ name, email, type, message, language }` as JSON.

With neither set, the inquiry is copied to the clipboard and the status region says
so explicitly. A hidden honeypot field (`company`) silently absorbs bots.

---

## Configuration

`src/config.ts`:

```ts
export const siteConfig = {
  url: 'https://sifr.studio',
  contactEmail: '',   // e.g. 'hello@sifr.studio'
  formEndpoint: '',   // e.g. 'https://formspree.io/f/xxxx'
};
```

`astro.config.mjs` — set `site` to the production domain before deploying, and
adjust `vite.build.chunkSizeWarningLimit` if you change the three.js setup.

---

## Scripts

| Command              | Action                                        |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Dev server at `http://localhost:4321`         |
| `npm run check`      | Type-check `.astro` + TypeScript (0 errors)   |
| `npm run build`      | Production build to `dist/`                   |
| `npm run preview`    | Preview the production build                  |

---

## Build output

`npm run build` emits a fully static site:

```
dist/
├── index.html
├── favicon.svg
└── _astro/
    ├── index.*.css        ~28 kB — design system + components
    ├── index.*.js         ~24 kB — UI behaviour
    ├── Hero.*.js           ~7 kB — orb bootstrap (lazy)
    └── three.*.js        ~660 kB — three.js, own chunk, loaded on demand
```

three.js is forced into its own long-lived chunk (`manualChunks` in
`astro.config.mjs`) so the small site bundle stays cacheable independently of the
3D scene, and the heavy chunk is only fetched when the hero is seen.

---

## Deployment

1. `npm run build`
2. Serve `dist/` from any static host (Nginx, Netlify, Vercel, Cloudflare Pages,
   GitHub Pages, S3 + CloudFront…).
3. Set `site` in `astro.config.mjs` to the real domain.
4. Point the form at a backend via `src/config.ts`, or leave it on the clipboard
   fallback if the site is a placeholder.

No server runtime, environment variables, or database are required.

---

## Accessibility and UX

- Skip link, visible focus rings, `aria-live` form status, `role="status"`.
- Single `<h1>`; heading levels descend without skipping.
- `prefers-reduced-motion` disables animations and reveals.
- `prefers-reduced-transparency` and `prefers-contrast` are respected.
- Full keyboard support for the mobile menu (focus trap, `Esc` to close).

---

## Credits

Design and original single-file build: `Qwen_html_20261115_osk7p251v.html`.
Astro port, component split, and WebGL enhancements: this repository.