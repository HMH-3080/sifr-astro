## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Project conventions

- Source in `src/`; page composed from components in `src/components/`.
- All copy lives in `src/i18n/translations.ts`; markup carries `data-i18n` keys.
- Client behaviour is split: `src/scripts/site.ts` (UI) and `orb-scene.ts` (WebGL).
- Add new sections as components and mount them in `src/pages/index.astro`.

## Verification

```
npm run check   # astro check (types)
npm run build   # production build to dist/
```

After changes, run both. Do not commit `dist/`.
