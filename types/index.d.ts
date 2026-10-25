/**
 * AfterSWF embed: a SWFObject-compatible API that embeds AwayFL players
 */

export interface IBindingConfig {
    /** Where the player's loader.js, runtime.js and assets/ are (defaults to embed's own folder) */
    runtimeBaseUrl?: string;
    src?: string;
    width?: string | number;
    height?: string | number;
    /** Name of a global function to call when the SWF has loaded */
    onLoad?: string;
    /** Name of a global function to call with loading progress */
    onProgress?: string;
    /** Name of a global function to call if loading fails */
    onError?: string;
    /** Flash `scale`: showAll (default), noScale, exactFit or noBorder */
    scaleMode?: string;
    /** Flash `salign`: T, B, L, R, TL, TR, BL or BR */
    stageAlign?: string;
    autoplay?: boolean;
    /** Background colour of the player and its loading screen */
    backgroundColor?: string;
    /** Flash `bgcolor`: overrides the SWF's background colour, e.g. #ffffff */
    bgcolor?: string;
    /** Flash `flashvars`: a query string (a=1&b=2) or an object */
    flashvars?: string | Record<string, any>;
    /** URL of the loading screen's image, or false or '' for none */
    splash?: string | boolean;
    progress?: boolean | {
        back: string;
        rect: [number, number, number, number];
        line: string;
        direction?: 'lr' | 'tb';
    };
    /** Limits stage scale to improve performance, e.g. 0.5 for half resolution */
    maxStageScale?: number;
    /** Hide the player until the SWF has loaded */
    hideBeforeLoad?: boolean;
    /** Smooth bitmaps by default (Flash Player defaults to pixelated scaling) */
    smoothBitmaps?: boolean;
    /** Enable blend modes (experimental) */
    enableBlends?: boolean;
    /** Enable filters such as blur and glow (experimental) */
    enableFilters?: boolean;
}

export interface IEmbedConfig extends IBindingConfig {
    /** Replace Flash <object> and <embed> markup with players (default true) */
    autoUpgrade?: boolean;
}

/**
 * Sets options for players, the same as defining `window.AWAY_EMBED_CFG`
 */
export function configure(config: IEmbedConfig): void;

/** The version of @afterswf/embed */
export const VERSION: string;

/**
 * The `<awayfl-player>` element. Functions a SWF adds with
 * `ExternalInterface.addCallback()` become methods of it.
 */
export declare class AwayPlayerComponent extends HTMLElement {
    readonly player: any;
    config: IBindingConfig;
    src: string;
    width: string | number;
    height: string | number;
    runtimeBaseUrl: string;
    [callback: string]: any;
}

export interface SWFObjectCallbackEvent {
    success: boolean;
    id: string;
    ref?: AwayPlayerComponent;
}

export type SWFObjectCallback = (event: SWFObjectCallbackEvent) => void;

export interface SWFObjectAPI {
    ua: { w3: boolean; pv: number[]; wk: number | false; ie: boolean; win: boolean; mac: boolean };
    embedSWF(
        swfUrl: string,
        replaceElemId: string | HTMLElement,
        width: string | number,
        height: string | number,
        swfVersion?: string,
        xiSwfUrl?: string | null,
        flashvars?: Record<string, any> | null,
        params?: Record<string, any> | null,
        attributes?: Record<string, any> | null,
        callback?: SWFObjectCallback
    ): void;
    registerObject(objectId: string, swfVersion: string, xiSwfUrl?: string, callback?: SWFObjectCallback): void;
    createSWF(attributes: Record<string, any>, params: Record<string, any>, replaceElemId: string): AwayPlayerComponent | undefined;
    removeSWF(objectId: string): void;
    getObjectById(objectId: string): AwayPlayerComponent | null;
    /** Reports Flash Player 32.0.0 */
    getFlashPlayerVersion(): { major: number; minor: number; release: number };
    hasFlashPlayerVersion(version: string): boolean;
    showExpressInstall(attributes: any, params: any, replaceElemId: string, callback?: SWFObjectCallback): void;
    createCSS(selector: string, declaration: string, media?: string, newStyle?: boolean): void;
    addDomLoadEvent(fn: () => void): void;
    addLoadEvent(fn: () => void): void;
    getQueryParamValue(param?: string): string;
    switchOffAutoHideShow(): void;
    enableUriEncoding(enable?: boolean): void;
    expressInstallCallback(): void;
}

/** SWFObject 2.x */
export const swfobject: SWFObjectAPI;
export const swfObject: SWFObjectAPI;

/** SWFObject 1.5 */
export declare class SWFObject {
    constructor(swf: string, id: string, width: string | number, height: string | number,
        version?: string, bgcolor?: string, quality?: string);
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string;
    addParam(name: string, value: string): void;
    getParams(): Record<string, string>;
    addVariable(name: string, value: string): void;
    getVariable(name: string): string;
    getVariables(): Record<string, string>;
    getVariablePairs(): string[];
    useExpressInstall(path: string): void;
    write(elementId: string | HTMLElement): boolean;
}

declare global {
    interface Window {
        swfobject: SWFObjectAPI;
        swfObject: SWFObjectAPI;
        SWFObject: typeof SWFObject;
        AWAY_EMBED_CFG?: IEmbedConfig;
    }

    interface HTMLElementTagNameMap {
        'awayfl-player': AwayPlayerComponent;
    }
}
