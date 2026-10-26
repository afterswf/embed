# Agent notes — awayfl-embed (afterswf fork)

Context for AI agents (and humans) working in this repo. Written after a long
debugging campaign reviving a real AS3 app ("The Music Machine") on this
player; most of the non-obvious facts below were learned the hard way.

## What this repo is

Bundler/wrapper around the `@awayfl/*` + `@awayjs/*` **npm packages**. It owns
almost no runtime code itself:

- `src/embed/` → `dist/embed.js` (classic script) and `dist/embed.mjs` (ES
  module exporting `swfobject`/`swfObject`, `SWFObject`,
  `AwayPlayerComponent` and `configure()`; both also set the globals) — runs
  in the host page. Hand-written types for the module are in
  `types/index.d.ts`; keep them in step with the exports.
  - `index.ts` — exports, globals, and starting the auto-upgrade a tick after
    DOM ready (so an importing module can `configure()` first)
  - `AwayPlayerComponent.ts` — `<awayfl-player>` custom element; maps Flash
    params/attributes (`flashvars`, `bgcolor`, `scale`, `salign`, `movie`…)
    onto its config and renders the player in a same-origin `srcdoc` iframe
  - `swfobject.ts` — SWFObject 2.x API (`swfobject`/`swfObject`) and 1.5's
    `SWFObject` constructor
  - `flashMarkup.ts` — replaces `<object>`/`<embed>` Flash markup with players
    (static publishing, and a MutationObserver for later markup)
- `src/loader/` → `dist/loader.js` — SWF fetch/decompress + progress UI
- `src/runtime.ts` → `dist/runtime.js` (~2.5 MB) — the actual player: rolls up
  `@awayfl/avm1`, `@awayfl/avm2`, `@awayfl/playerglobal`, `@awayfl/swf-loader`,
  `@awayjs/*`; also applies `bgcolor`. Flashvars travel in the game config
  (`flashvars`) to avm1's `AVM1Handler` (`_level0` variables) and
  playerglobal's `LoaderInfo.parameters`
- `src/externalInterface.ts` — points swf-loader's `ExternalInterfaceService`
  at the host page, so `ExternalInterface` reaches it synchronously
- `static/` → `dist/assets/` (playerglobal builtins ABCs, fonts.swf)

Runtime bugs are almost never in this repo — they're in the dependency
packages. This fork's fixes live in the afterswf forks of six of them
(see below).

## Fork state

The fixes are on `main` of the [afterswf](https://github.com/afterswf) forks
(future npm names `@afterswf/avm1`, `@afterswf/avm2`, `@afterswf/graphics`,
`@afterswf/playerglobal`, `@afterswf/renderer`, `@afterswf/scene`):

- **avm1** — FlashVars and the SWF URL's query string become `_level0`
  variables before any ActionScript runs (so `#initclip` code sees them);
  AS2 `ExternalInterface` goes through swf-loader's `ExternalInterfaceService`
  like AS3's, converting values both ways. SWFs loaded with `loadMovie` get
  their own `AVM1SceneGraphFactory` (symbol IDs are per SWF, so a shared one
  gave a loaded SWF the main SWF's symbols); `setNewTextFormat` merges like
  `setTextFormat`; `updateGraphics()` exists (scene calls it; avm1's
  `tsc || exit 0` build hid the type error); `Mouse.onMouseWheel` is
  broadcast.
- **scene** (input) — Tab/Shift+Tab move focus between tab-enabled objects
  via `TabPicker` (keyboard focus selects a field's text); wheel events use
  the standard `wheel` event, reach the stage like mouse moves, and carry
  Flash's `delta` (whole lines, 3 a notch, positive up).
- **playerglobal** — `lineStyle` maps AS3's caps/joints strings to
  `@awayjs/graphics`' numeric `CapsStyle`/`JointStyle` (they were passed
  through as strings, so every AS3 thick stroke got bevel joints and no
  caps), defaulting to Flash's round caps and joints, and clamps
  `miterLimit` to [1, 255]; `readGraphicsData` maps them back.
  `LoaderInfo.parameters` (URL query string + config
  `flashvars`); `ExternalInterface` callbacks return JS values, not JS
  source strings, and strings are escaped safely for `call()`; Flash
  Remoting (AMF-over-HTTP) in `NetConnection`/`Responder`; `MouseCursorData`
  linked; aggregated
  `EventDispatcher` reports `_t` as `currentTarget` (GreenSock fix);
  `removeChild` warns instead of throwing #2025 (ticker-killer fix);
  `Graphics.lineStyle` clamps alpha to [0,1] like Flash (`beginFill`
  already clamped, strokes didn't; see renderer for why alphas above 1
  matter). `tabEnabled`/`tabIndex` pass through to the adaptee (were stubs).
- **graphics** — thick strokes tessellated to triangles (orphaned
  `getTriangleElements`) so lineStyle joints/caps apply; the default
  LineElements path cannot form joints (per-segment quads).
- **avm2** — Proxy trap dispatch falls back to public-mangled (`$Bg…`)
  subclass overrides; receiver preserved.
- **scene** — `htmlText` entities decoded once, after parsing (`&amp;`,
  `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&#38;`, `&#x20AC;`), and a bare `&`
  shown as itself. node-html-parser 1.4.9's `text` is the raw text, so
  previously only `&gt;` was decoded and "A & B" showed as "A &amp; B".
- **renderer** — `ShaderBase` clamps (`sat`) each channel after the colour
  transform, as Flash does. Without it, premultiplying alpha multiplied RGB
  by any alpha above 1: the Music Machine's deployed SWF (older than its
  source) has `Line.draw(..., alpha:Number = 100)`, so its chart labels came
  out cyan (`#00A0C6` × 100) and white (`#F0037F` × 100, invisible).

How they get into the bundle:

- `package.json` keeps the **original dependency names** (`@awayfl/avm1`,
  `@awayfl/avm2`, `@awayjs/graphics`, `@awayfl/playerglobal`,
  `@awayjs/renderer`, `@awayjs/scene`) but points them at sibling checkouts
  (`file:../avm2` etc.), so npm links
  them as aliases (`npm ls` shows `@awayfl/avm2@npm:@afterswf/avm2 -> ./../avm2`).
  Keeping the old names means this repo *and* every unforked package that
  imports them (awayfl-player, swf-loader, …) resolve to the one fork.
- **When `@afterswf/*` is on npm:** change each spec to an npm alias, e.g.
  `"@awayfl/avm2": "npm:@afterswf/avm2@^0.2.241"` — nothing else changes.
- rollup bundles `package.json#module` → `dist/index.js` → `dist/lib/**` of
  each checkout, so **each checkout must be built** (its `dist/` is
  gitignored). Their `prepare` script (`tsc:build`) runs on every
  `npm install` here, but not on `npm run build` — after editing a checkout,
  rerun `npm run tsc:build` there (or keep `npm run watch` going). Changing
  only `lib/*.ts` does nothing to this build.
- **Without sibling checkouts** (CI, another machine): use
  `"@awayfl/avm2": "github:afterswf/avm2#main"` etc. npm clones each fork,
  installs its devDeps, runs `prepare` and packs the result (`.npmignore`
  keeps `dist/`). Fork changes only arrive after a push and
  `npm update @awayfl/avm2`.
- Linked checkouts carry their own `node_modules` (older `@awayjs/*` pinned
  by their `yarn.lock`). `rollup.config.js` `dedupe`s every `@awayfl/*`,
  `@awayjs/*` and `tslib` import to this repo's `node_modules`, and
  `tsconfig.json` `paths` does the same for type-checking — without these
  the bundle gets duplicate copies (and TS reports bogus `IAVMHandler`
  mismatches between the two `@awayjs/scene`s).
Known gaps, for another day:

- **Stage alignment** (`salign`, `Stage.align`) does nothing: swf-loader's
  `AVMStage.resizeStageInternal` always centres a scaled stage, `noScale`
  is always top-left, and `exactFit` crops like `noBorder`. It logs "Stage:
  only implemented StageAlign is TOP_LEFT" on every resize, as avm1 sets
  `align = 'T'`. Needs the `afterswf/swf-loader` fork (cloned to
  `../swf-loader`, not linked yet); don't silence it from avm1, as AS1/2's
  default should be centred (`''`).
- **Password fields** show their text: scene's `TextField.displayAsPassword`
  is stored but never used.
- **Mouse wheel** over the player also scrolls a scrollable page; Flash
  usually stopped that. Only prevent it for SWFs that listen for the wheel.

- Upstream PR branches exist for all three fix sets (2026-07-10):
  - `awayfl/playerglobal` ← `feat/amf-remoting-and-runtime-fixes` (#25)
  - `awayfl/avm2` ← `fix/proxy-public-mangled-trap-overrides` (#13)
  - `awayjs/graphics` ← `fix/stroke-joints-triangle-tessellation` (#12)

## Building

```sh
# once per checkout, in each of ../avm1, ../avm2, ../graphics, ../playerglobal, ../renderer, ../scene
npx yarn@1 install --frozen-lockfile

npm install          # links the checkouts and builds their dist/ (prepare → tsc:build)
npm run build        # all three bundles + assets (prebuild cleans + copies static/)
npx rollup -c --bundleConfigAsCjs --runtime   # runtime.js only (~12 s) — use during iteration
```

Gotchas:

- **rollup can linger after writing the bundles** (open handle somewhere; the
  process sits at 0% CPU and never exits). `npm run build` passes
  `--forceExit`; when running rollup directly, the output is complete once
  "created ./dist/runtime.js" is printed — `pkill -f 'rollup -c'` and move on.
- **Toolchain is pinned exactly** (`rollup@4.6.1`, `typescript@5.3.3`,
  official `@rollup/plugin-typescript`). History: the original
  `rollup-plugin-typescript2` is unmaintained and fails under current
  Node/rollup; caret drift to rollup 4.6x broke the build entirely. Don't
  "upgrade" casually.
- `package-lock.json` is **gitignored** in this repo, so the exact pins in
  `package.json` are the only reproducibility mechanism.
- The player finds `loader.js`, `runtime.js` and `assets/` from its own URL
  (`import.meta.url`, which rollup compiles to `document.currentScript` for
  `embed.js`), or `runtimeBaseUrl`. Loaded from esm.sh, the module isn't next
  to them, so `runtimeBaseUrl` must point at a CDN serving the package's
  files as they are (jsDelivr).

## Publishing

Everything embed bundles is a `devDependency`, since `dist/` is
self-contained, so its `file:../` specs don't affect people installing it.
`dist/` is committed and rebuilt by `npm version`. The forks don't commit
`dist/`/`bundle/`; their `prepublishOnly` runs the full build (tsc + the UMD
bundle that `main` points at). All have `publishConfig.access: public`.
Every repo's `prepublishOnly` first runs `bumpIfPublished.mjs`, which runs
`npm version patch` when the current version is already on npm (see
[RELEASING.md](./RELEASING.md) for the version rules).
Publish the forks in dependency order (renderer → graphics → scene → avm2 →
avm1 → playerglobal), then embed.

The forks keep upstream's import names, so their `peerDependencies` and
`devDependencies` point those names at the other forks with npm aliases
(e.g. `"@awayjs/scene": "npm:@afterswf/scene@^0.13.325"`); unforked
packages' plain ranges for the same names are satisfied by them. Their
lockfiles have current versions of the unforked `@awayjs`/`@awayfl`
packages, so the only type errors left are upstream's (e.g.
`AssetEvent.INVALIDATE`/`CLEAR`, missing from the published
`@awayjs/core`). UMD bundles keep every `@awayjs`/`@awayfl` package
external (playerglobal's didn't for scene, which broke its build).

The step-by-step release process is in [RELEASING.md](./RELEASING.md).

## Editing the dependency packages

Edit the forked packages in their own checkouts, not in `node_modules`:

1. Edit `lib/**/*.ts` in the checkout (`../avm1`, `../avm2`, `../graphics`, `../playerglobal`,
   `../renderer` or `../scene`)
   (commit there, on a branch merged into its `main`)
2. `npm run tsc:build` in that checkout (or `npm run watch` while iterating;
   `tsc:build` ignores the type errors described below, so JS still emits)
3. Rebuild the runtime here and test

Packages that aren't forked yet (swf-loader, core, stage, materials, …) need forking
into afterswf first, then adding as another `file:` alias plus a checkout.

Caveat: graphics and playerglobal report dozens of type errors against the
older `@awayjs/*`/`@awayfl/avm2` versions their `yarn.lock` pins (e.g.
`Int32Vector`, `IContainer`, `readGraphicsData` missing). They're version
skew only — tsc still emits, and the bundle resolves those imports to the
current packages here.

## AVM2 / playerglobal facts that will bite you

- **Never `new NativeClass()` for objects that compiled AS3 will touch or that
  need VM machinery.** Raw instances lack runtime traits (compiled property/
  method access fails with cryptic `getTraitMultiname` errors) and miss
  `instanceNatives` mixins (`new ByteArray()` throws `_resetViews is not a
  function` — its buffer methods live on `DataBuffer.prototype`, merged only
  onto the VM-linked prototype). Construct via
  `sec.application.getClass(Multiname.FromFQNString(fqn, 0)).axConstruct([...])`
  and set `.sec` on ByteArrays (the `SharedObject` idiom).
- **Native methods receive AS3 arguments flat** — `...rest` collection only
  happens for compiled AS3 methods. Grab extras from `arguments`.
- `sec.flash.*` (SecurityDomain map) is incomplete — e.g. no
  `events.NetStatusEvent`. Don't assume a class is there; check
  `lib/SecurityDomain.ts`.
- Public-namespace mangling is `$Bg<name>`; namespaced traits hash the URI
  (e.g. flash_proxy → `$G_v0hLC<name>`). ABC interning can put subclass
  overrides on the public mangling — the cause of the Proxy fix.
- `(a || b)(args)` **loses `this`** — a receiver-dropping bug like this cost
  hours; use `.call(this, …)` when dispatching looked-up methods.
- Debugging: exceptions inside Timer-driven AS3 (incl. anything started via
  `setTimeout`, i.e. most app `init()`s) are swallowed by an empty `catch {}`
  in playerglobal's Timer tick — a stalled app with a clean console usually
  means a swallowed throw. Instrument that catch when hunting.
- Flash clamps alpha parameters to [0, 1], and colour transform results per
  channel; content can still pass alphas above 1 (0-100 percentages from
  AS2-era habits). Anywhere such a value reaches rendering unclamped, colours
  come out wrong (see the renderer fix).
- Runtime-drawn strokes only get joint/cap styles via the triangle
  tessellation route (see the graphics fix); GPU LineElements are
  per-segment quads and cannot form joints.
- Quick instrumentation trick: patch `dist/runtime.js` text directly
  (python replace on the built bundle) to add gated `console.warn`s — the
  next rollup rebuild wipes it automatically, so there's nothing to revert.
  Same trick produced before/after PR screenshots:
  `git show <old-commit>:dist/runtime.js` → swap in → screenshot → restore.

## Testing against the reference app

The Music Machine (AS3/Flex-era, Proxy-based AMF service layer → Zend_Amf on
PHP 8.5) lives at `/Users/neil/Projects/imp1154-esp-music-machine-v2/www/4`
and embeds via `swfObject.embedSWF`. Its `awayfl/` is a **symlink to this
repo's `dist/`** (tracked in that repo). Serve with
`php -S 127.0.0.1:8080` from that dir (needs the local `mysql` docker
container running).

Headless smoke test (Playwright; `npm i playwright` somewhere convenient).
The app runs inside a **srcdoc iframe**; init-script globals reach it:

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.context().addInitScript(() => { self.__AWAYFL_AMF_DEBUG = true; });
  p.on('console', m => console.log(m.type(), m.text().slice(0, 200)));
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('http://localhost:8080/');
  await p.waitForTimeout(9000);              // app boots to login screen
  await p.mouse.click(805, 128); await p.keyboard.type('user');   // username field
  await p.mouse.click(805, 159); await p.keyboard.type('pass');   // password field
  await p.mouse.click(760, 252);             // submit → authUser AMF call
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'state.png' }); // wrong creds ⇒ red "Login Error"
  await b.close();
})();
```

Expected healthy boot: 6 AMF calls (`getChannelList`, `getGenreList`,
`getProductTypeList`, `getRegionList`, `getFirstDayOfOccWeek`, `authToken`)
each answered `onResult`, then `NetConnection.Connect.Success`. Wire bytes:
`window.__awayflAMF.lastRequest/.lastResponse` in the iframe context.

Chart smoke test (needs a valid login — a local dev user exists; ask Neil or
check the local `users` table): after login you land on Search. Click the
Artist field (~240,128), type `muse`, click Search (~365,128), click the
first result (~568,154), then "Weekly sales spot analysis" (~937,188).
Verify: line colours match the axis label colours (left `#00A0C6`, right
`#F0037F`), corners of the polylines are sharp miters (no notches), and the
soft-pink Mkt Trend stays soft (its 0.15 alpha is by design).
