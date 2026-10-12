# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Tests

Unit tests (Vitest), no network or database needed:

```bash
npm test            # watch
npx vitest run      # once
```

## Live smoke tests (Playwright)

Read-only checks against the **deployed** site. They open pages and read them —
nothing is created, changed or saved.

One-off setup:

```bash
npm install                        # brings in @playwright/test
npx playwright install chromium    # once per machine
```

Then create a local **`.env.e2e`** (git-ignored — **never commit it**) holding the
test user:

```
E2E_EMAIL=the-test-user@example.com
E2E_PASSWORD=...
```

Run them:

```bash
npm run e2e                                      # against https://glazepro.vercel.app
E2E_BASE_URL=http://localhost:5173 npm run e2e   # against a local dev server
npm run e2e -- --headed                          # watch it in a browser
npm run e2e -- -g "fanlight"                     # one test
```

What they check (`e2e/smoke.spec.js`):

- login works;
- `/dev/pricing-benchmark` — every benchmark PASSES except the parked residuals in
  `docs/integrate-differences.md`, which must still show **exactly** their parked
  amounts (a residual that moves, or that quietly turns green, fails the test);
- `/drawing-board/24` — the parts tree reads "Fanlight A1" then "Casement Sash A2",
  in that order, and the validation panel finishes loading with no error and no
  unevaluable check;
- `/leads/9/quotes` — the page loads and every drawing card shows a price.

Selectors are `data-testid` attributes, not page text, so wording changes do not
break the tests.
