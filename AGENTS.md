# Agent notes — awayfl-embed (mesmotronic fork)

Context for AI agents (and humans) working in this repo. Written after a long
debugging campaign reviving a real AS3 app ("The Music Machine") on this
player; most of the non-obvious facts below were learned the hard way.

## What this repo is

Bundler/wrapper around the `@awayfl/*` + `@awayjs/*` **npm packages**. It owns
almost no runtime code itself:

- `src/embed/` → `dist/embed.js` — `<awayfl-player>` custom element + swfobject shim
- `src/loader/` → `dist/loader.js` — SWF fetch/decompress + progress UI
- `src/runtime.ts` → `dist/runtime.js` (~2.5 MB) — the actual player: rolls up
  `@awayfl/avm2`, `@awayfl/playerglobal`, `@awayfl/swf-loader`, `@awayjs/*`
- `static/` → `dist/assets/` (playerglobal builtins ABCs, fonts.swf, splash)

Runtime bugs are almost never in this repo — they're in the dependency
packages. This fork carries fixes for them via `patches/` (see below).

## Fork state (branch `feat/net`)

- **`patches/@awayfl+playerglobal+*.patch`** — Flash Remoting (AMF-over-HTTP)
  in `NetConnection`/`Responder`; `MouseCursorData` linked; aggregated
  `EventDispatcher` reports `_t` as `currentTarget` (GreenSock fix);
  `removeChild` warns instead of throwing #2025 (ticker-killer fix).
- **`patches/@awayjs+graphics+*.patch`** — thick strokes tessellated to
  triangles (orphaned `getTriangleElements`) so lineStyle joints/caps apply;
  the default LineElements path cannot form joints (per-segment quads).
- **`patches/@awayfl+avm2+*.patch`** — Proxy trap dispatch falls back to
  public-mangled (`$Bg…`) subclass overrides; receiver preserved.
- Applied by `postinstall` (patch-package). Each patch changes **both**
  `lib/*.ts` (source of truth, upstreamable) **and** `dist/lib/*.js` (what
  rollup actually bundles — `package.json#module` → `dist/index.js` barrel →
  `dist/lib/**`). Changing only the .ts does nothing to the build.
- Upstream PRs for both patch sets were submitted (2026-07-10) to
  `awayfl/playerglobal` (`feat/amf-remoting-and-runtime-fixes`) and
  `awayfl/avm2` (`fix/proxy-public-mangled-trap-overrides`) from the
  mesmotronic forks. **When merged & published:** bump the dep versions here,
  delete the corresponding patch file(s), rebuild. patch-package hard-errors
  on version mismatch, so a stale patch cannot be applied silently.

## Building

```sh
npm install          # postinstall applies patches/
npm run build        # all three bundles + assets (prebuild cleans + copies static/)
npx rollup -c --bundleConfigAsCjs --runtime   # runtime.js only (~12 s) — use during iteration
```

Gotchas:

- **rollup lingers after writing the bundles** (open handle somewhere; the
  process sits at 0% CPU and never exits). The output is complete once
  "created ./dist/runtime.js" is printed — `pkill -f 'rollup -c'` and move on.
  Don't chain `build && test` and expect it to proceed.
- **Toolchain is pinned exactly** (`rollup@4.6.1`, `typescript@5.3.3`,
  official `@rollup/plugin-typescript`). History: the original
  `rollup-plugin-typescript2` is unmaintained and fails under current
  Node/rollup; caret drift to rollup 4.6x broke the build entirely. Don't
  "upgrade" casually.
- `package-lock.json` is **gitignored** in this repo, so the exact pins in
  `package.json` are the only reproducibility mechanism.

## Editing the dependency packages (the `.build-tmp` workflow)

`tsc` refuses to emit for files under `node_modules` (treats them as external
library files), so you can't just edit and rebuild in place:

1. `cp -r node_modules/@awayfl/<pkg> .build-tmp/` (gitignored dir; ancestor
   `node_modules` still resolves imports from there)
2. Edit `lib/**/*.ts` in the copy
3. `../../node_modules/.bin/tsc -p tsconfig.build.json` in the copy —
   `tsconfig.build.json` just adds `"ignoreDeprecations": "5.0"`; the root
   devDeps include `@types/wicg-file-system-access` which playerglobal needs
4. `rsync -a .build-tmp/<pkg>/lib/ node_modules/@awayfl/<pkg>/lib/` and same
   for `dist/`
5. Rebuild runtime, test, then `npx patch-package @awayfl/<pkg>` to capture

tsc output is deterministic — regenerating all of `dist/` produces clean,
minimal patch-package diffs.

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
  overrides on the public mangling — the cause of the Proxy patch.
- `(a || b)(args)` **loses `this`** — a receiver-dropping bug like this cost
  hours; use `.call(this, …)` when dispatching looked-up methods.
- Debugging: exceptions inside Timer-driven AS3 (incl. anything started via
  `setTimeout`, i.e. most app `init()`s) are swallowed by an empty `catch {}`
  in playerglobal's Timer tick — a stalled app with a clean console usually
  means a swallowed throw. Instrument that catch when hunting.

## Testing against the reference app

The Music Machine (AS3/Flex-era, Proxy-based AMF service layer → Zend_Amf on
PHP 8.5) lives at `/Users/neil/Desktop/4`; `awayfl/` there is a **symlink to
this repo's `dist/`**. Serve with `php -S localhost:8080` from that dir
(needs the local MySQL docker container running). A pre-fork hand-patched
bundle is kept at `awayfl.patched/` as fallback.

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
