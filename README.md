# BugBoard end-to-end tests

Playwright suite covering [BugBoard](https://github.com/mariusuncrop/bugboard-app) — API and UI, four browsers,
accessibility and visual regression.

```
395 tests · 50 API · 84 UI across 4 browser projects · 7 visual baselines · ~80s on 4 workers
```

## Running it

The suite drives a live instance, so start the app first:

```bash
git clone https://github.com/mariusuncrop/bugboard-app
cd bugboard-app && npm install && npm run dev
```

Then, in this repository:

```bash
npm install
npx playwright install --with-deps
npm test
```

If the app is not up, the run stops immediately with a message saying so rather than failing 300 tests on
connection errors.

| Command | Runs |
| --- | --- |
| `npm test` | Everything |
| `npm run test:api` | API only — no browser needed, about two seconds |
| `npm run test:ui` | UI on Chromium |
| `npm run test:all-browsers` | Chromium, Firefox and WebKit |
| `npm run test:mobile` | Pixel 5 emulation |
| `npm run test:visual` | Screenshot comparisons |
| `npm run test:headed` / `npm run test:debug` | Watch it, or step through it |
| `npm run report` | Open the last HTML report |

Point it somewhere else with `BASE_URL` and `API_URL` — see [.env.example](.env.example).

## How it is put together

```
src/
  api/client.ts       Typed API client used to arrange state and to test the API directly
  api/schemas.ts      zod schemas — response validation doubles as contract testing
  pages/              Page objects: locators and actions, no assertions
  fixtures/index.ts   Custom fixtures — API clients, page objects, a disposable issue
  support/            Environment config, global setup
tests/
  auth.setup.ts       Signs in over the API once, saves browser state for every UI project
  api/                50 API tests
  ui/                 84 UI tests, run against each of four browser projects
  visual/             Screenshot baselines, run one worker at a time
```

### Projects

| Project | What it covers |
| --- | --- |
| `api` | The REST API directly. No browser, so it is the fastest signal available |
| `setup` | Signs in and saves storage state — every UI project depends on it |
| `chromium` / `firefox` / `webkit` | The full UI suite on each engine |
| `mobile-chrome` | The same suite under Pixel 5 emulation |
| `visual` | Screenshot comparison against the untouched seed data |

## Decisions worth explaining

These are the parts that took thought, and the reasoning matters more than the code.

### Tests create their own data

The app ships a reset endpoint, and it is tempting to call it before every test. That serialises the whole suite:
with parallel workers, one test's reset wipes another's fixtures halfway through.

Instead the suite resets **once**, in global setup, then every test that writes creates what it needs through the
API and removes it afterwards — usually via the `tempIssue` fixture:

```ts
test('moves a card to another column', async ({ boardPage, tempIssue }) => {
  await boardPage.goto();
  await boardPage.moveViaSelect(tempIssue.key, 'in_progress');
  // ...
});
```

Read-only tests assert against the seed fixture, which nothing mutates. The result runs fully parallel and has
survived repeated back-to-back runs without a flake.

The one exception is the `visual` project, which needs the database untouched: it runs on a single worker with its
own reset.

### Logging in over the API, once

`tests/auth.setup.ts` authenticates through the API and saves the browser state. Every UI project loads it, so no
test pays for a login it is not actually testing. The login form itself is covered properly in
[tests/ui/auth.spec.ts](tests/ui/auth.spec.ts), which opts out of the saved state.

### Assert the UI first, then the API

Reading the API straight after a UI action races the request that action started:

```ts
await issueDetail.setStatus('todo');
expect((await api.getIssue(key)).status).toBe('todo');   // flaky — the PATCH may still be in flight
```

Waiting for the app to confirm the write first makes it deterministic:

```ts
await issueDetail.setStatus('todo');
await expect(toast).toContainText('Status updated.');    // auto-retries
expect((await api.getIssue(key)).status).toBe('todo');
```

The same rule applies to `allTextContents()` and friends: they take one snapshot and never retry, so an
auto-retrying assertion has to come first.

### Drag and drop, honestly

`locator.dragTo()` is intermittently unreliable for native HTML5 drag and drop — the browser needs several mouse
moves after the button goes down before it starts firing `dragover`. `BoardPage.dragCardTo()` drives the mouse
directly, aims at the visible part of the target column (the board scrolls, so the middle of a column is often
off screen), and throws a readable error if the target cannot be reached at the current viewport size.

On touch devices the gesture does not apply at all, so that test skips with a stated reason and the accessible
move control — which is what a touch or keyboard user actually uses — is covered instead.

### Ordering that parallel tests cannot disturb

Anything asserting on pagination or ordering asks for `sort=createdAt&order=asc`. Issues created by other workers
are then appended at the end instead of shifting rows between pages mid-test.

### Response schemas as a contract test

Every API client method validates its response with zod. A renamed or dropped field fails the API suite with a
precise message, instead of surfacing three specs later as a confusing UI failure.

## Accessibility

[tests/ui/accessibility.spec.ts](tests/ui/accessibility.spec.ts) scans the main pages with `@axe-core/playwright`
against WCAG 2.1 A and AA, and adds a few checks automation cannot infer — that the confirmation dialog is a real
modal and takes focus, and that the login form is usable with the keyboard alone.

Automated scans catch roughly a third of accessibility defects. A green run is a floor, not a pass mark. This one
did find real contrast failures on the avatar colours, which were fixed in the app.

## Visual regression

Baselines live in `tests/visual/__screenshots__/{project}/{platform}/`, one set per platform — a macOS run and a
Linux CI run render text differently, so they cannot share a baseline.

```bash
npm run test:visual              # compare
npm run test:update-snapshots    # accept the current appearance
```

Comparisons run with a 1% pixel tolerance, animations disabled, and a fixed viewport, locale and timezone. They
stay stable because the app's seed fixture uses fixed ids and fixed timestamps.

Generate Linux baselines the same way CI does:

```bash
docker run --rm -v "$(pwd)":/work -w /work --network host \
  mcr.microsoft.com/playwright:v1.49.1-noble \
  npx playwright test --project=visual --update-snapshots
```

## Continuous integration

[.github/workflows/e2e.yml](.github/workflows/e2e.yml) checks out the app, starts it, and runs:

- the API suite as its own job — fast feedback before any browser starts
- the UI suite sharded across four runners, in parallel across the browser projects
- the visual suite, when Linux baselines are present

Shards report as blob reports and are merged into one HTML report, uploaded as a build artefact. To host that
report instead, enable GitHub Pages for the repository with GitHub Actions as the source and set the repository
variable `PUBLISH_REPORT` to `true`. Traces, screenshots and video are retained on failure.

### Dropping files that never existed on disk

Playwright cannot drag a file in from the operating system, so
[`src/support/dragAndDrop.ts`](src/support/dragAndDrop.ts) builds a `DataTransfer` inside the page from bytes read
in Node, then dispatches `dragenter`, `dragover` and `drop` by hand. The fixtures are the same files the
click-to-browse specs use, so both routes into the app are tested against identical input — and the helper drives
the real listeners rather than reaching past them into React state.

### Waiting on an element that exists, not one that is merely enabled

`setInputFiles` does not wait for an input to become enabled — it fills a disabled one quite happily. The new-issue
form only renders its file input once it has fetched the upload limits, so the test waits for the element to be
*attached*, which is a guarantee Playwright does honour. Disabling the input instead looked equivalent and let a
file through under parallel load about one run in five.

## What it found

Written against the app as it stood, the suite caught five real defects, all since fixed:

| Defect | Caught by |
| --- | --- |
| Every unknown `/api/*` path returned `401` instead of `404`, because auth middleware was mounted too broadly | `tests/api/contract.spec.ts` |
| Signing in from a protected page always landed on `/board`, discarding the page the visitor asked for | `tests/ui/auth.spec.ts` |
| Avatar initials failed WCAG AA contrast on every page that shows a user | `tests/ui/accessibility.spec.ts` |
| Toast notifications rendered off screen on mobile — the board's intrinsic width was widening the layout viewport | `tests/ui/navigation.spec.ts` under `mobile-chrome` |
| The board never fit at desktop width, so the last column was always cut off | Visual baselines |
| The new-issue form accepted files before it knew the upload limits, silently skipping client-side validation | `tests/ui/create-issue.spec.ts` under `mobile-chrome` |

## Licence

[MIT](LICENSE)
