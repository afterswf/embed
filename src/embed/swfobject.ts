/**
 * SWFObject 2.x API, with SWFObject 1.5's constructor, embedding AwayFL players
 * in place of the Flash plugin
 */
import { AwayPlayerComponent } from './AwayPlayerComponent';
import { createPlayer, isFlashElement, upgradeElement } from './flashMarkup';

type TStringMap = {[name: string]: string};
type TCallback = (event: {success: boolean, id: string, ref?: HTMLElement}) => void;

/**
 * The Flash Player version reported to pages, so they don't take their "no Flash" branch
 */
const PLAYER_VERSION = [32, 0, 0];

const userAgent = navigator.userAgent.toLowerCase();
const platform = (navigator.platform || '').toLowerCase();

const ua = {
    w3: true,
    pv: PLAYER_VERSION.slice(),
    wk: /webkit/.test(userAgent) ? parseFloat(userAgent.replace(/^.*webkit\/(\d+(\.\d+)?).*$/, '$1')) : false,
    ie: false,
    win: /win/.test(platform || userAgent),
    mac: /mac/.test(platform || userAgent),
};

let encodeURIEnabled = false;
let autoHideShow = true;
let dynamicStylesheet: HTMLStyleElement = null;
let dynamicStylesheetMedia: string = null;

function isDomLoaded() {
    return document.readyState !== 'loading';
}

function getElement(id: string | HTMLElement): HTMLElement {
    return typeof id === 'string' ? document.getElementById(id) : id;
}

// by tag, as the element may be another build's class if both are loaded
function isPlayer(el: Element): el is AwayPlayerComponent {
    return !!el && el.localName === 'awayfl-player';
}

export function addDomLoadEvent(fn: () => void) {
    if (isDomLoaded()) {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', () => fn());
    }
}

function addLoadEvent(fn: () => void) {
    if (document.readyState === 'complete') {
        setTimeout(fn);
    } else {
        window.addEventListener('load', () => fn());
    }
}

function hasPlayerVersion(versionStr: string): boolean {
    const v = String(versionStr).split('.');
    const required = [parseInt(v[0], 10), parseInt(v[1], 10) || 0, parseInt(v[2], 10) || 0];
    const pv = PLAYER_VERSION;

    return pv[0] > required[0]
        || (pv[0] === required[0] && pv[1] > required[1])
        || (pv[0] === required[0] && pv[1] === required[1] && pv[2] >= required[2]);
}

function createCSS(selStr: string, declStr: string, mediaStr?: string, newStyleBoolean?: boolean) {
    const head = document.head;
    if (!head) {
        return;
    }

    const media = typeof mediaStr === 'string' && mediaStr ? mediaStr : 'screen';

    if (newStyleBoolean) {
        dynamicStylesheet = null;
        dynamicStylesheetMedia = null;
    }

    if (!dynamicStylesheet || dynamicStylesheetMedia !== media) {
        dynamicStylesheet = document.createElement('style');
        dynamicStylesheet.media = media;
        dynamicStylesheetMedia = media;
        head.appendChild(dynamicStylesheet);
    }

    dynamicStylesheet.appendChild(document.createTextNode(selStr + ' {' + declStr + '}'));
}

/**
 * Hides alternative content until it's replaced, as SWFObject does
 */
function setVisibility(id: string, isVisible: boolean) {
    if (!autoHideShow || !id) {
        return;
    }

    const visibility = isVisible ? 'visible' : 'hidden';
    const el = document.getElementById(id);

    if (isDomLoaded() && el) {
        el.style.visibility = visibility;
    } else {
        createCSS('#' + CSS.escape(id), 'visibility:' + visibility);
    }
}

function createSWF(attObj: any, parObj: any, replaceElemIdStr: string | HTMLElement): AwayPlayerComponent {
    const el = getElement(replaceElemIdStr);

    if (!el || !attObj || !attObj.data) {
        return undefined;
    }

    if (typeof attObj.id === 'undefined' && el.id) {
        attObj.id = el.id;
    }

    const attributes: TStringMap = {src: '' + attObj.data};
    for (const key in attObj) {
        const name = key.toLowerCase();

        if (name === 'styleclass') {
            attributes['class'] = '' + attObj[key];
        } else if (name !== 'classid' && name !== 'data') {
            attributes[key] = '' + attObj[key];
        }
    }

    const params: TStringMap = {};
    for (const key in parObj) {
        if (key.toLowerCase() !== 'movie') {
            params[key] = '' + parObj[key];
        }
    }

    const player = createPlayer(attributes, params);
    el.parentNode.replaceChild(player, el);

    return player;
}

function buildFlashVars(flashvarsObj: any): string {
    if (!flashvarsObj || typeof flashvarsObj !== 'object') {
        return '';
    }

    return Object.keys(flashvarsObj)
        .map((key) => key + '=' + (encodeURIEnabled ? encodeURIComponent(flashvarsObj[key]) : flashvarsObj[key]))
        .join('&');
}

function embedSWF(
    swfUrlStr: string,
    replaceElemIdStr: string | HTMLElement,
    widthStr: string | number,
    heightStr: string | number,
    swfVersionStr?: string,
    _xiSwfUrlStr?: string,
    flashvarsObj?: any,
    parObj?: any,
    attObj?: any,
    callbackFn?: TCallback
) {
    const id = typeof replaceElemIdStr === 'string' ? replaceElemIdStr : replaceElemIdStr && replaceElemIdStr.id;
    const callbackObj: Parameters<TCallback>[0] = {success: false, id};

    // unlike SWFObject the version is optional, as AwayFL's own examples omit it
    if (!swfUrlStr || !replaceElemIdStr || !widthStr || !heightStr) {
        callbackFn && callbackFn(callbackObj);
        return;
    }

    setVisibility(id, false);

    addDomLoadEvent(() => {
        // copied, as pages often reuse these objects for several SWFs
        const att = Object.assign({}, attObj, {data: swfUrlStr, width: '' + widthStr, height: '' + heightStr});
        const par = Object.assign({}, parObj);
        const flashvars = buildFlashVars(flashvarsObj);

        if (flashvars) {
            par.flashvars = typeof par.flashvars !== 'undefined' ? par.flashvars + '&' + flashvars : flashvars;
        }

        if (!swfVersionStr || hasPlayerVersion(swfVersionStr)) {
            const ref = createSWF(att, par, replaceElemIdStr);

            if (att.id == id) {
                setVisibility(id, true);
            }

            callbackObj.success = !!ref;
            if (ref) {
                callbackObj.ref = ref;
            }
        } else {
            // show the alternative content
            setVisibility(id, true);
        }

        callbackFn && callbackFn(callbackObj);
    });
}

/**
 * Static publishing: replaces the page's <object> markup with a player
 */
function registerObject(objectIdStr: string, swfVersionStr: string, _xiSwfUrlStr?: string, callbackFn?: TCallback) {
    if (!objectIdStr || !swfVersionStr) {
        callbackFn && callbackFn({success: false, id: objectIdStr});
        return;
    }

    setVisibility(objectIdStr, false);

    addDomLoadEvent(() => {
        const callbackObj: Parameters<TCallback>[0] = {success: false, id: objectIdStr};

        if (hasPlayerVersion(swfVersionStr)) {
            let ref = document.getElementById(objectIdStr);

            // may already have been upgraded with the rest of the page's markup
            if (ref && !isPlayer(ref)) {
                ref = isFlashElement(ref) ? upgradeElement(ref) : null;
            }

            if (ref) {
                callbackObj.success = true;
                callbackObj.ref = ref;
            }
        }

        setVisibility(objectIdStr, true);
        callbackFn && callbackFn(callbackObj);
    });
}

function getObjectById(objectIdStr: string): AwayPlayerComponent {
    const el = document.getElementById(objectIdStr);
    return isPlayer(el) ? el : null;
}

function removeSWF(objElemIdStr: string) {
    const el = document.getElementById(objElemIdStr);

    if (el && (isPlayer(el) || isFlashElement(el))) {
        el.remove();
    }
}

function urlEncodeIfNecessary(s: string): string {
    return /[\\\"<>\.;]/.test(s) ? encodeURIComponent(s) : s;
}

function getQueryParamValue(param?: string): string {
    let q = document.location.search || document.location.hash;

    if (q) {
        if (/\?/.test(q)) {
            q = q.split('?')[1];
        }

        if (param == null) {
            return urlEncodeIfNecessary(q);
        }

        const pairs = q.split('&');
        for (let i = 0; i < pairs.length; i++) {
            if (pairs[i].substring(0, pairs[i].indexOf('=')) == param) {
                return urlEncodeIfNecessary(pairs[i].substring(pairs[i].indexOf('=') + 1));
            }
        }
    }

    return '';
}

export const swfobject = {
    registerObject,
    getObjectById,
    embedSWF,
    switchOffAutoHideShow() {
        autoHideShow = false;
    },
    enableUriEncoding(enable?: boolean) {
        encodeURIEnabled = typeof enable === 'undefined' ? true : !!enable;
    },
    ua,
    getFlashPlayerVersion() {
        return {major: PLAYER_VERSION[0], minor: PLAYER_VERSION[1], release: PLAYER_VERSION[2]};
    },
    hasFlashPlayerVersion: hasPlayerVersion,
    createSWF(attObj: any, parObj: any, replaceElemIdStr: string) {
        return createSWF(attObj, parObj, replaceElemIdStr);
    },
    showExpressInstall(_att: any, _par: any, replaceElemIdStr: string, callbackFn?: TCallback) {
        console.warn('[AwayFL] Express Install is not needed or supported');
        callbackFn && callbackFn({success: false, id: replaceElemIdStr});
    },
    removeSWF,
    createCSS,
    addDomLoadEvent,
    addLoadEvent,
    getQueryParamValue,
    expressInstallCallback() {},
};

/**
 * SWFObject 1.5: `new SWFObject(swf, id, width, height, version, bgcolor).write(elementId)`,
 * which renders the SWF inside the target element
 */
export class SWFObject {
    private _attributes: TStringMap = {};
    private _params: TStringMap = {};
    private _variables: TStringMap = {};

    constructor(swf: string, id: string, w: string | number, h: string | number, ver?: string, c?: string, quality?: string) {
        this.setAttribute('swf', swf);
        this.setAttribute('id', id);
        this.setAttribute('width', '' + w);
        this.setAttribute('height', '' + h);
        this.setAttribute('version', ver);

        if (c) {
            this.addParam('bgcolor', c);
        }
        this.addParam('quality', quality || 'high');
    }

    setAttribute(name: string, value: string) {
        this._attributes[name] = value;
    }

    getAttribute(name: string): string {
        return this._attributes[name] || '';
    }

    addParam(name: string, value: string) {
        this._params[name] = value;
    }

    getParams(): TStringMap {
        return this._params;
    }

    addVariable(name: string, value: string) {
        this._variables[name] = value;
    }

    getVariable(name: string): string {
        return this._variables[name] || '';
    }

    getVariables(): TStringMap {
        return this._variables;
    }

    getVariablePairs(): string[] {
        return Object.keys(this._variables).map((key) => key + '=' + this._variables[key]);
    }

    useExpressInstall(_path: string) {}

    write(elementId: string | HTMLElement): boolean {
        const target = getElement(elementId);

        if (!target) {
            return false;
        }

        const id = this.getAttribute('id');
        const params = Object.assign({}, this._params);
        const flashvars = this.getVariablePairs().join('&');

        if (flashvars) {
            params.flashvars = flashvars;
        }

        const player = createPlayer({
            src: this.getAttribute('swf'),
            id,
            name: id,
            width: this.getAttribute('width'),
            height: this.getAttribute('height'),
        }, params);

        target.innerHTML = '';
        target.appendChild(player);

        return true;
    }
}
