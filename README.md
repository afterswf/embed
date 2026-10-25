AwayFL Embedded Player
==================
AwayFL helps you save your Flash games and keep them running after 2020!

> **Fork notes:** this fork adds Flash Remoting (AMF-over-HTTP) support and several
> runtime fixes, which live in the [afterswf](https://github.com/afterswf) forks of
> [`avm1`](https://github.com/afterswf/avm1), [`avm2`](https://github.com/afterswf/avm2),
> [`graphics`](https://github.com/afterswf/graphics),
> [`playerglobal`](https://github.com/afterswf/playerglobal) and
> [`scene`](https://github.com/afterswf/scene). Until those are published
> to npm as `@afterswf/*`, `package.json` aliases `@awayfl/avm1`, `@awayfl/avm2`,
> `@awayjs/graphics`, `@awayfl/playerglobal` and `@awayjs/scene` to local checkouts in
> sibling folders (`../avm1` etc.), so this repo and every `@awayfl/*`/`@awayjs/*` package
> it bundles use the forks. Install each checkout's dependencies first; `npm install` here
> then builds their `dist/` via their `prepare` scripts:
>
> ```sh
> # in each of ../avm1, ../avm2, ../graphics, ../playerglobal, ../scene
> npx yarn@1 install --frozen-lockfile
> ```
>
> To build without sibling checkouts, point the aliases at GitHub instead
> (`"@awayfl/avm2": "github:afterswf/avm2#main"` etc.) — npm clones, builds and packs them.
>
> Fixes included:
>
> * **`@awayfl/playerglobal`**
>   * `flash.net.NetConnection`: working `connect()`/`call()` for HTTP(S) AMF remoting
>     gateways (Zend_Amf, AMFPHP, …). Arguments and results are serialised with the AVM2
>     ByteArray AMF codec; only the remoting packet envelope is hand-written. Faults are
>     routed to `Responder.status` / `NetConnection.Call.Failed`. Debug logging via
>     `self.__AWAYFL_AMF_DEBUG = true`.
>   * `flash.net.Responder`: `invokeResult`/`invokeStatus` helpers.
>   * `flash.ui.MouseCursorData`: linked (fresh data-holder implementation) so content
>     using `Mouse.registerCursor` no longer dies with "Class native is not defined".
>   * `EventDispatcherBase`: `event.currentTarget` now reports the aggregation target
>     (`new EventDispatcher(target)`) during dispatch, matching Flash — GreenSock event
>     handlers rely on this.
>   * `DisplayObjectContainer.removeChild`: no longer throws #2025 when the internal
>     scene graph has already detached the child — the throw could erupt through a frame
>     callback and kill the ticker.
> * **`@awayjs/graphics`**
>   * Thick strokes (>1.5px, non-hairline) are tessellated to triangles via the
>     existing (previously unused) `getTriangleElements`, so `lineStyle` joint
>     styles (miter/bevel/round) and caps actually apply. The GPU-expanded
>     LineElements path draws each segment as an independent quad and leaves a
>     notch at every corner of a polyline.
> * **`@awayfl/avm2`**
>   * `Proxy` (flash.utils.Proxy): trap dispatch now finds subclass overrides whose
>     traits were mangled into the public namespace (`$Bg…`) instead of the flash_proxy
>     namespace — previously `flash_proxy override function callProperty` etc. were
>     unreachable and dynamic property access threw #2088–#2096.
>
> Build toolchain: `rollup-plugin-typescript2` was replaced with the official
> `@rollup/plugin-typescript` (rpt2 fails under current Node/rollup), and rollup /
> typescript are pinned to known-good versions.

Check your game on:
https://awayfl.org/swf-tester/

__How to use__

There are 3 main ways to use AwayFL on your site:

1. [As a drop-in replacement for SWFObject](./example/index.html)
    * Load the AwayFL player instead of, or as well as, `swfobject.js` (either order works). For example:
        `<script src="../dist/embed.js"></script>`
    * Existing [SWFObject](https://web.archive.org/web/20140704095451if_/http://code.google.com/p/swfobject/wiki/documentation#STEP_3:_Embed_your_SWF_with) code then embeds AwayFL players instead of Flash. For example:
        `swfobject.embedSWF('Embedded.swf', 'container', '550', '400', '9.0.0', null, {name: 'value'});`
      * SWFObject 2.x, as `swfobject` and `swfObject`: `embedSWF`, `registerObject` (static publishing), `createSWF`, `removeSWF`, `getObjectById`, `getFlashPlayerVersion` (reports 32.0.0), `hasFlashPlayerVersion`, `addDomLoadEvent`, `addLoadEvent`, `getQueryParamValue`, `createCSS`, `switchOffAutoHideShow`, `enableUriEncoding` and `ua`. As with SWFObject, callbacks run once the player element has been created, with `success: false` if it couldn't be; errors loading the SWF are reported by the element's `error` event.
      * SWFObject 1.5: `new SWFObject(swf, id, width, height, version, bgcolor)`, with `addParam`, `addVariable` and `write(elementId)`.
    * Hard-coded Flash `<object>` and `<embed>` markup is replaced with players too, including markup added to the page later. To turn this off, set `AWAY_EMBED_CFG.autoUpgrade = false`.
    * Flash parameters (`<param>`s, SWFObject's `params`, or `<embed>` attributes):
      * `flashvars` become `loaderInfo.parameters` in AS3 and `_root` variables in AS1/2, as do any query string parameters in the SWF's URL
      * `bgcolor` overrides the SWF's background colour, and `scale` and `salign` set the stage's scale mode and alignment
      * others, such as `wmode`, `allowScriptAccess` and `quality`, are accepted and ignored
    * Attributes such as `id`, `class` (or SWFObject's `styleclass`), `name` and `style` are copied onto the `<awayfl-player>` element.
    * `ExternalInterface` (AS2 and AS3) connects to the page as it did with the Flash plugin: `ExternalInterface.call()` runs in the page, and functions added with `ExternalInterface.addCallback()` become methods of the player element, e.g. `swfobject.getObjectById('game').myCallback()`.
    * Whether a SWF needs AVM1 (AS1/2) or AVM2 (AS3) is detected automatically.
    * Optional: Configure AwayFL using the `AWAY_EMBED_CFG` variable.
        This allows you to customize AwayFL's behavior. For a list of available options, see the [IBindingConfig interface](./src/embed/AwayPlayerComponent.ts).

2. Using the AwayFL loader and a custom config:
    * Grab the template from [/src/embed/embed.html](./src/embed/embed.html)
    * Replace `__LOADER_URL__` with the URL of the AwayFL loader script (`loader.js`)
    * Replace `__GAME_CONFIG__` with a game configuration JSON (or object) conforming to the [AwayFL config interface](./src/loader/iConfigBase.ts).
    * To run your game, add a `GAME` resource record to the `binary` array of the game configuration.
      * Example: `{path: path/to/game.swf, resourceType:'GAME'}`
    * If your game uses external fonts, you will need to create separate SWF file(s) containing these fonts, then add font resource records to the `binary` array. 
      * Example: `{path: path/to/font.swf, resourceType:'FONTS'}`
    
    Full Example:
    ```
    const gameConfig = {
        width: 550,
        height: 400,
        splash: './splash.png',
        progress: { // optional
            back: 'cover url(./progressBack.png)',
            line: #cc0022, // or image, it will passed to progressLine background,
            rect: [0, 0.9, 1, 0.1] // x, y, width, height of preogress line relative container 
        },
        baseUrl: '../dist',
        runtime: ['../dist/runtime.js'],
        binary: [{
            path: 'Embedded.swf',
            resourceType: 'GAME',
            name: 'Game', // not used atm
            meta: {} // not used atm
        }],
    }
    ```

3. Creating a custom loader that loads SWF data from an ArrayBuffer:
    * Load the AwayFL runtime from `dist/runtime.js`
    * Construct the player: `const player = new AWAYFL.Player();`
    * Call `player.loadBuffer(arrayBuffer);`

