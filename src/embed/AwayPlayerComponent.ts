//@ts-ignore
import template from "./embed.html";

import { IGameConfigBase } from "../loader/iConfigBase";

interface IAwayPlayer {
    new(config: IGameConfigBase);
    loadAndPlay(): Promise<void>;
    loadBuffer(buffer: ArrayBuffer): Promise<void>;
    play(): void;
    stop(): void;
}

// rollup turns import.meta.url into document.currentScript's src in the classic
// script build; in the ES module build it's the module's own URL
const scriptBaseUrl = new URL('.', import.meta.url).href;
// a plain bar across the middle; its colours come from the element's text colour
const defaultProgress = {
    "direction": "lr",
    "rect": [
        0.25,
        0.495,
        0.5,
        0.01
    ]
};

export interface IBindingConfig {
    version?: string;
    runtimeBaseUrl: string;
    src: string;
    width: string | number;
    height: string | number;
    onLoad?: string;
    onProgress?: string;
    onError?: string;
    /**
     * @description Flash `scale`: showAll (default), noScale, exactFit or noBorder
     */
    scaleMode?: string;
    /**
     * @description Flash `salign`: T, B, L, R, TL, TR, BL or BR
     */
    stageAlign?: string;
    autoplay?: boolean;
    backgroundColor?: string;
    /**
     * @description Flash `bgcolor`: overrides the SWF's background colour, e.g. #ffffff
     */
    bgcolor?: string;
    /**
     * @description Flash `flashvars`: a query string (a=1&b=2) or an object
     */
    flashvars?: string | {[name: string]: any};
    splash?: string | boolean,
    /**
     * @description The loading bar, or false for none. Its colours default to the element's text colour
     */
    progress?: boolean | {
		back?: string;
		rect?: [number, number, number, number],
		line?: string;
		direction?: 'lr' | 'tb'
	},

    /**
     * @description A decimal value between 0 and 1. Limits stage scale to improve performance.
     * For example, 0.5 limits the player to half resolution.
     */
    maxStageScale?: number;
    /**
     * @description Hide player content before loading
     */
    hideBeforeLoad?: boolean;

    /**
     * @kind Runtime
     * @description Smooth bitmaps by default. Flash Player defaults to pixelated scaling.
     */
    smoothBitmaps?: boolean;

    /**
     * @kind Runtime
     * @description Enable blend modes (experimental)
     */
    enableBlends?: boolean;

    /**
     * @kind Runtime
     * @description Enable filters such as blur and glow (experimental)
     */
    enableFilters?: boolean;
}

type TBindingScheme = {[key in keyof IBindingConfig]: {required?: boolean, default?: any}};

/**
 * Flash <object>/<embed> parameter and attribute names that map onto config keys.
 * Others, such as wmode, allowScriptAccess, quality and menu, have no equivalent
 * and are ignored.
 */
const FLASH_PARAMS: {[name: string]: keyof IBindingConfig} = {
    movie: 'src',
    data: 'src',
    flashvars: 'flashvars',
    bgcolor: 'bgcolor',
    scale: 'scaleMode',
    salign: 'stageAlign',
};

const SCALE_MODES = {
    showall: 'showAll',
    all: 'showAll',
    noborder: 'noBorder',
    exactfit: 'exactFit',
    noscale: 'noScale',
};

export function parseFlashVars(value: string | {[name: string]: any}): {[name: string]: string} {
    const result = {};

    if (typeof value === 'string') {
        new URLSearchParams(value).forEach((v, k) => {
            result[k] = v;
        });
    } else if (value) {
        for (const key in value) {
            result[key] = String(value[key]);
        }
    }

    return result;
}

function parseColor(value: string): number {
    const match = /^#?([0-9a-f]{6})$/i.exec(value || '');
    return match ? parseInt(match[1], 16) : null;
}

function normalizeAlign(value: string): string {
    const v = value.toUpperCase();
    return (v.indexOf('T') > -1 ? 'T' : v.indexOf('B') > -1 ? 'B' : '')
        + (v.indexOf('L') > -1 ? 'L' : v.indexOf('R') > -1 ? 'R' : '');
}

function cssSize(value: string | number): string {
    return /^\d+(\.\d+)?$/.test('' + value) ? value + 'px' : '' + value;
}

export class AwayPlayerComponent extends HTMLElement {
    static get observedAttributes() {
        return [
            'src',
            'width',
            'height'
        ];
    }

    private static BINDING_CONFIG: TBindingScheme = {
        version: {required: false, default: 'latest'},
        runtimeBaseUrl: {required: false, default: scriptBaseUrl},
        src: {required: true},
        width: {required: false, default: 550},
        height: {required: false, default: 400},
        onLoad: {required: false},
        onProgress: {required: false},
        onError: {required: false},
        scaleMode: {required: false, default: 'showAll'},
        stageAlign: {required: false},
        autoplay: {required: false, default: true},
        hideBeforeLoad: {required: false, default: false},
        maxStageScale: {required: false, default: undefined},
        // transparent while loading, then the stage colour, as in Flash
        backgroundColor: {required: false},
        bgcolor: {required: false},
        flashvars: {required: false},
        // an image to show while loading
        splash: {required: false},
        progress: {required: false, default: defaultProgress},

        // runtime
        smoothBitmaps: {required: false, default: false},
        enableBlends: {required: false, default: false},
        enableFilters: {required: false, default: false},
    };

    _loaderHolder: HTMLDivElement;
    _runConfig: IBindingConfig = <any>{};
    _gameFrame: HTMLIFrameElement;
    _player: IAwayPlayer;
    _root: ShadowRoot;
    _style: HTMLStyleElement;

    get player() {
        return this._player;
    }

    get config() {
        return this._runConfig;
    }
    set config(cfg) {
        this._runConfig = cfg;
    }

    get src() {
        return this._runConfig.src || this.getAttribute('src');
    }
    set src(v) {
        this._runConfig.src = v;
    }

    set width(v: number | string) {
        this._runConfig.width = v;
    }
    get width() {
        return this._runConfig.width || this.getAttribute('width');
    }

    set height(v: number | string) {
        this._runConfig.height = v;
    }
    get height() {
        return this._runConfig.height || this.getAttribute('height');
    }

    set runtimeBaseUrl(v: string) {
        this._runConfig.runtimeBaseUrl = v;
    }
    get runtimeBaseUrl() {
        return this._runConfig.runtimeBaseUrl;
    }

    constructor(){
        super();

        this.onError = this.onError.bind(this);
        this._root = this.attachShadow({mode:'closed'});
    }

    _getRuntimeUrl() {
        const baseUrl = this._runConfig.runtimeBaseUrl;
        const loader  = new URL('loader.js', baseUrl).href;
        const runtime = new URL('runtime.js', baseUrl).href;
        /**
         * @todo support runtime version
         **/
        return {
            loader,
            runtime,
            baseUrl,
        }
    }

    _dropPlayer() {
        if (this._gameFrame) {
            this._gameFrame.remove();
            this._player = null;
        }
    }

    onError(_arg: any) {
        const f = this._runConfig.onError && self[this._runConfig.onError];

        if (typeof f === 'function') {
            f(_arg);
        }

        this.dispatchEvent(new ErrorEvent('error', {
            error: new Error('Awayfl runtime error'),
            message: _arg?.message || _arg,
        }));
    }

    _attachRuntimeEvents() {
        const fd = this._gameFrame.contentWindow;
        //@ts-ignore
        fd.addEventListener('awayfl-player-init', ({detail}) =>{
            this._player = detail;
        }, {once: true});

        fd.addEventListener('awayfl-player-load', () => {
            const f = this._runConfig.onLoad && self[this._runConfig.onLoad];

            if (typeof f === 'function') {
                f();
            }

            this.dispatchEvent(new CustomEvent('load'));
            this._gameFrame.style.display = '';

        }, {once: true});

        //@ts-ignore
        fd.addEventListener('awayfl-player-error', ({detail}) => this.onError(detail), {once: true});

        //@ts-ignore
        fd.addEventListener('awayfl-player-progress', ({detail}) => {
            const f = this._runConfig.onProgress && self[this._runConfig.onProgress];

            if (typeof f === 'function') {
                f(detail);
            }


            this.dispatchEvent(new CustomEvent('progress', {detail}));
        });

    }

    /**
     * The loading bar, in the element's text colour on a fainter track unless
     * colours are given, so it suits the page it's on
     */
    _progressConfig() {
        const progress = this._runConfig.progress;

        if (!progress) {
            return false;
        }

        const color = getComputedStyle(this).color;

        return {
            line: color,
            back: `color-mix(in srgb, ${color} 20%, transparent)`,
            ...defaultProgress,
            ...(typeof progress === 'object' ? progress : {}),
        };
    }

    _buildTemplate(frame: HTMLIFrameElement): string {
        const t: string = template;
        const urls = this._getRuntimeUrl();

        const gameConfig = {
            width: frame.clientWidth,
            height: frame.clientHeight,
            backgroundColor: this._runConfig.backgroundColor,
            splash: this._runConfig.splash,
            progress: this._progressConfig(),
            runtime: [urls.runtime],
            binary: [{
                path: this._runConfig.src,
                resourceType: 'GAME',
                name: 'Game',
                meta: {}
            }],
            //debug: true,
            baseUrl: urls.baseUrl,
            maxStageScale: +this._runConfig.maxStageScale,
            flashvars: parseFlashVars(this._runConfig.flashvars),
            stageScaleMode: this._runConfig.scaleMode,
            stageAlign: this._runConfig.stageAlign,
            stageColor: parseColor(this._runConfig.bgcolor),
            runtimeFlags: {
                defaultSmoothBitmap: !!this._runConfig.smoothBitmaps,
                enableBlends: !!this._runConfig.enableBlends,
                enableFilters: !!this._runConfig.enableFilters,
            }
        }

        return t
            .replace(/__LOADER_URL__/, urls.loader)
            .replace(/__GAME_CONFIG__/, JSON.stringify(JSON.stringify(gameConfig)));
    }

    _constructPlayer() {
        const root = this._root;
        const frame = document.createElement('iframe');

        frame.style.display = this._runConfig.hideBeforeLoad ? 'none' : ''

        this._gameFrame = frame;

        root.appendChild(frame);

        frame.addEventListener('load', this._attachRuntimeEvents.bind(this), {
            once: true
        });

        frame.addEventListener('error', this.onError);
        frame.srcdoc = this._buildTemplate(frame);
    }

    /**
     * Config key for a param or attribute name, matched case-insensitively as
     * HTML lowercases attribute names and Flash param names ignore case
     */
    _configKey(name: string): keyof IBindingConfig {
        const lower = name.toLowerCase();

        if (lower in FLASH_PARAMS) {
            return FLASH_PARAMS[lower];
        }

        return <keyof IBindingConfig>Object.keys(AwayPlayerComponent.BINDING_CONFIG)
            .find((key) => key.toLowerCase() === lower);
    }

    _mapAttrs() {
        const params: NodeListOf<HTMLParamElement> = this.querySelectorAll('param');
        const config = <any>this._runConfig;

        params.forEach(node => {
            const key = this._configKey(node.name);
            if (key) {
                config[key] = node.value;
            }
        });

        this.getAttributeNames().forEach(name => {
            const key = this._configKey(name);
            if (key) {
                config[key] = this.getAttribute(name);
            }
        });
    }

    _loadGlobalConfig() {
        const global = <any>window;
        const globalCfg = global.AWAY_EMBED_CFG || {};
        const scheme = AwayPlayerComponent.BINDING_CONFIG;

        for(const [key, value] of Object.entries(globalCfg)) {
            if (key in scheme) {
                this._runConfig[key] = value;
            }
        }
    }

    _setDefaults() {
        const scheme = AwayPlayerComponent.BINDING_CONFIG;
        for(const key in scheme) {
            if (scheme[key].required && typeof this._runConfig[key] === 'undefined') {
                throw `Parameter ${key} is required!`;
            }

            if (typeof this._runConfig[key] === 'undefined') {
                this._runConfig[key] = scheme[key].default;
            }
        }
    }

    _normalizeConfig() {
        const config = this._runConfig;

        // absolute and ending in a slash, so the runtime's files resolve inside it
        config.runtimeBaseUrl = new URL(config.runtimeBaseUrl.replace(/\/?$/, '/'), document.baseURI).href;

        config.scaleMode = SCALE_MODES[('' + config.scaleMode).toLowerCase()] || config.scaleMode;

        if (config.stageAlign) {
            config.stageAlign = normalizeAlign(config.stageAlign) || undefined;
        }

        // params and attributes are strings, but "false" shouldn't mean true
        for (const key of ['autoplay', 'hideBeforeLoad', 'smoothBitmaps', 'enableBlends', 'enableFilters']) {
            if (typeof config[key] === 'string') {
                config[key] = !/^(false|0)$/i.test(config[key].trim());
            }
        }
        if (config.splash === 'false') {
            config.splash = false;
        }
        if (<any>config.progress === 'false') {
            config.progress = false;
        }

        if (config.bgcolor) {
            config.backgroundColor = parseColor(config.bgcolor) === null
                ? config.bgcolor
                : '#' + config.bgcolor.replace('#', '');
        }
    }

    _updateStyle() {
        this._style.textContent = `
            :host {
                display: inline-block;
                contain: content;
                width: ${cssSize(this._runConfig.width)};
                height: ${cssSize(this._runConfig.height)};
            }
            iframe {
                display: block;
                width: 100%;
                height: 100%;
                border: none;
                /* matches the frame's own document, or browsers make the frame opaque */
                color-scheme: light;
            }
            `;
    }

    connectedCallback() {
        setTimeout(() => {
            this._loaderHolder = this.querySelector('div.awayfl__loader');
            this._loadGlobalConfig();
            this._mapAttrs();
            this._setDefaults();
            this._normalizeConfig();

            this._style = document.createElement('style');
            this._updateStyle();
            this._root.appendChild(this._style);

            this._constructPlayer();
        });
    }

    disconnectedCallback() {
        this._dropPlayer();
    }

    attributeChangedCallback(name: string, _oldValue: any, newValue: any) {
        if(!this.isConnected) {
            return;
        }

        // if SRC changed, drop runtime and load again
        if (name === 'src' && this._player) {
            this._dropPlayer();
            this._runConfig.src = newValue;
            this._constructPlayer();

            return;
        }

        if ((name === 'width' || name === 'height') && this._style) {
            this._runConfig[name] = newValue;
            this._updateStyle();
        }
    }
}

// both the script and module builds may be loaded
if (!customElements.get('awayfl-player')) {
    customElements.define('awayfl-player', AwayPlayerComponent);
}
