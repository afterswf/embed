AfterSWF
========

AfterSWF is [Mesmotronic](https://mesmotronic.com)'s fork of [AwayFL](https://github.com/awayfl/awayfl-embed),
the open-source Flash player for the browser. It adds the following functionality to enable it to render more advanced AS3 content and make it a
better drop-in replacement for the original SWFObject.

### A better drop-in replacement for SWFObject

| Feature | What you get |
|---|---|
| SWFObject 2.x | `swfobject` (and `swfObject`) supports `embedSWF`, `registerObject`, `createSWF`, `removeSWF`, `getObjectById`, `hasFlashPlayerVersion`, `getFlashPlayerVersion` (which reports Flash Player 32), `addDomLoadEvent`, `addLoadEvent` and `getQueryParamValue`, with SWFObject's callback behaviour |
| SWFObject 1.5 | `new SWFObject(swf, id, width, height, version, bgcolor)`, with `addParam`, `addVariable` and `write` |
| Hard-coded embeds | Flash `<object>` and `<embed>` markup is replaced with players, including markup added after the page has loaded |
| Flash parameters | `flashvars`, `bgcolor`, `scale` and `salign` work as in Flash; others, such as `wmode`, are accepted and ignored. Attributes such as `id`, `class` and `name` are kept |
| ExternalInterface | `ExternalInterface.call()` in AS2 and AS3 runs in the page, and functions added with `addCallback()` become methods of the player element, with their return values |
| Load errors | Errors loading a SWF fire the player element's `error` event |

### More advanced AS3 content

| Feature | What you get | Package |
|---|---|---|
| Flash Remoting | `NetConnection.connect()` and `call()` work with HTTP(S) AMF gateways such as Zend_Amf and AMFPHP. Set `self.__AWAYFL_AMF_DEBUG = true` to log the traffic | [playerglobal](https://github.com/afterswf/playerglobal) |
| FlashVars | Available as `loaderInfo.parameters` in AS3 and as `_root` variables in AS1/2, along with any query string parameters in the SWF's URL | [playerglobal](https://github.com/afterswf/playerglobal), [avm1](https://github.com/afterswf/avm1) |
| `flash.utils.Proxy` | Subclasses' `flash_proxy` overrides are found, so dynamic property access works instead of throwing errors #2088–#2096 | [avm2](https://github.com/afterswf/avm2) |
| Lines | Miter, bevel and round joints and square and round caps render as in Flash, without notches at the corners, and `lineStyle` alpha is limited to 0–1 | [graphics](https://github.com/afterswf/graphics), [playerglobal](https://github.com/afterswf/playerglobal) |
| Colour transforms | Colours are clamped as in Flash, so an alpha above 1 no longer distorts them | [renderer](https://github.com/afterswf/renderer) |
| HTML text | Entities such as `&amp;`, `&lt;` and `&#163;` in `htmlText` display as in Flash | [scene](https://github.com/afterswf/scene) |
| Event targets | Events from an aggregated `EventDispatcher` report the right `currentTarget`, which GreenSock relies on | [playerglobal](https://github.com/afterswf/playerglobal) |
| Mouse cursors | `flash.ui.MouseCursorData` is available, so `Mouse.registerCursor` works | [playerglobal](https://github.com/afterswf/playerglobal) |
| Removing children | `removeChild` no longer throws error #2025 for children that have already been detached internally, which could stop playback | [playerglobal](https://github.com/afterswf/playerglobal) |

### Using it as a module

The embed script is also an ES module, which exports `swfobject` (and `swfObject`), `SWFObject`,
`AwayPlayerComponent` and `configure()`. For example, using [esm.sh](https://esm.sh):

```html
<div id="game"></div>

<script type="module">
  import { swfobject, configure } from 'https://esm.sh/@afterswf/embed';

  // the player loads its runtime and assets by URL, so point it at a CDN that serves the package's files as they are
  configure({ runtimeBaseUrl: 'https://cdn.jsdelivr.net/npm/@afterswf/embed/dist/' });

  swfobject.embedSWF('game.swf', 'game', 550, 400, '9.0.0', null, { level: 1 });
</script>
```

Use the same version in both URLs, e.g. `@afterswf/embed@x.y.z`, so they don't drift apart.

If you import from jsDelivr instead (`https://cdn.jsdelivr.net/npm/@afterswf/embed/dist/embed.mjs`), you don't
need to set `runtimeBaseUrl`, as the runtime is next to the module. With a bundler, install
`@afterswf/embed` and either serve its `dist/` folder or point `runtimeBaseUrl` at it.

Importing it also defines the global `swfobject`, so existing scripts on the page keep working, and
`configure()` takes the same options as `AWAY_EMBED_CFG`.

### Building

The fixes live in the [afterswf](https://github.com/afterswf) forks of avm1, avm2, graphics, playerglobal,
renderer and scene. Until they're published to npm as `@afterswf/*`, `package.json` points the original
package names (`@awayfl/avm1`, `@awayjs/graphics` etc.) at local checkouts in sibling folders (`../avm1`
etc.), so this repo and every package it bundles use the forks.

Install each checkout's dependencies first; `npm install` here then builds their `dist/` folders through
their `prepare` scripts:

```sh
# in each of ../avm1, ../avm2, ../graphics, ../playerglobal, ../renderer and ../scene
npx yarn@1 install --frozen-lockfile
```

To build without the sibling checkouts, point the packages at GitHub instead
(`"@awayfl/avm2": "github:afterswf/avm2#main"` etc.), and npm will clone, build and pack them.

The build uses the official `@rollup/plugin-typescript` instead of `rollup-plugin-typescript2`, which fails
with current versions of Node and rollup, and pins rollup and TypeScript to versions known to work.

---

# Original AwayFL README

AwayFL helps you save your Flash games and keep them running after 2020!

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

