import { AwayPlayerComponent } from './AwayPlayerComponent';

type TStringMap = {[name: string]: string};

const FLASH_CLASSID = 'clsid:d27cdb6e-ae6d-11cf-96b8-444553540000';
const FLASH_TYPES = ['application/x-shockwave-flash', 'application/futuresplash'];
const SWF_URL = /\.swf([?#]|$)/i;

/**
 * Attributes that describe the plugin rather than the element, so aren't copied
 */
const PLUGIN_ATTRIBUTES = ['classid', 'codebase', 'type', 'pluginspage', 'data', 'src', 'width', 'height'];

/**
 * Flash parameters, which <embed> takes as attributes
 */
const EMBED_PARAMS = [
    'flashvars', 'bgcolor', 'scale', 'salign', 'wmode', 'quality', 'menu', 'play', 'loop', 'base',
    'allowscriptaccess', 'allowfullscreen', 'allowfullscreeninteractive', 'allownetworking',
    'devicefont', 'seamlesstabbing', 'swliveconnect', 'swremote', 'swfversion', 'expressinstall',
];

interface IFlashMarkup {
    src?: string;
    attributes: TStringMap;
    params: TStringMap;
}

function paramsOf(el: Element): TStringMap {
    const params: TStringMap = {};

    for (const child of Array.from(el.children)) {
        if (child.localName === 'param' && child.getAttribute('name')) {
            params[child.getAttribute('name').toLowerCase()] = child.getAttribute('value') || '';
        }
    }

    return params;
}

export function isFlashElement(el: Element): boolean {
    const tag = el.localName;

    if (tag !== 'object' && tag !== 'embed') {
        return false;
    }

    if (FLASH_TYPES.indexOf((el.getAttribute('type') || '').toLowerCase()) > -1
        || (el.getAttribute('classid') || '').toLowerCase() === FLASH_CLASSID) {
        return true;
    }

    const url = tag === 'embed'
        ? el.getAttribute('src')
        : el.getAttribute('data') || paramsOf(el).movie;

    return SWF_URL.test(url || '');
}

function hasFlashAncestor(el: Element): boolean {
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (isFlashElement(parent)) {
            return true;
        }
    }
    return false;
}

/**
 * Reads an <object>/<embed> and any Flash elements nested in it (the usual
 * cross-browser markup), the outermost taking precedence
 */
function readFlashMarkup(outer: Element): IFlashMarkup {
    const markup: IFlashMarkup = {attributes: {}, params: {}};
    const elements = [outer].concat(Array.from(outer.querySelectorAll('object, embed')).filter(isFlashElement));

    const set = (map: TStringMap, name: string, value: string) => {
        if (!(name in map)) {
            map[name] = value;
        }
    };

    for (const el of elements) {
        const isEmbed = el.localName === 'embed';
        const params = paramsOf(el);

        markup.src = markup.src
            || el.getAttribute(isEmbed ? 'src' : 'data')
            || params.movie
            || params.src;

        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();

            if (name === 'width' || name === 'height') {
                set(markup.attributes, name, attr.value);
            } else if (isEmbed && EMBED_PARAMS.indexOf(name) > -1) {
                set(markup.params, name, attr.value);
            } else if (PLUGIN_ATTRIBUTES.indexOf(name) === -1) {
                set(markup.attributes, name, attr.value);
            }
        }

        for (const name in params) {
            if (name !== 'movie' && name !== 'src') {
                set(markup.params, name, params[name]);
            }
        }
    }

    return markup;
}

export function createPlayer(attributes: TStringMap, params: TStringMap): AwayPlayerComponent {
    const player = <AwayPlayerComponent>document.createElement('awayfl-player');

    for (const name in attributes) {
        try {
            player.setAttribute(name, attributes[name]);
        } catch (e) {
            console.warn(`[AwayFL] Skipping invalid attribute "${name}"`);
        }
    }

    for (const name in params) {
        const param = document.createElement('param');
        param.name = name;
        param.value = params[name];
        player.appendChild(param);
    }

    return player;
}

/**
 * Replaces Flash <object>/<embed> markup with an AwayFL player
 */
export function upgradeElement(el: Element): AwayPlayerComponent {
    const markup = readFlashMarkup(el);

    if (!markup.src) {
        return null;
    }

    const player = createPlayer(Object.assign({src: markup.src}, markup.attributes), markup.params);
    el.parentNode.replaceChild(player, el);

    return player;
}

export function upgradeAll(root: Element | Document = document) {
    if (root instanceof Element && isFlashElement(root)) {
        if (!hasFlashAncestor(root)) {
            upgradeElement(root);
        }
        return;
    }

    root.querySelectorAll('object, embed').forEach((el) => {
        // nested elements are detached once their outermost element is upgraded
        if (el.isConnected && isFlashElement(el) && !hasFlashAncestor(el)) {
            upgradeElement(el);
        }
    });
}

/**
 * Upgrades Flash markup added to the page after it has loaded
 */
export function observeFlashMarkup() {
    let pending: Element[] = [];

    const flush = () => {
        const added = pending;
        pending = [];
        added.forEach((el) => el.isConnected && upgradeAll(el));
    };

    new MutationObserver((records) => {
        const wasEmpty = !pending.length;

        for (const record of records) {
            record.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    pending.push(<Element>node);
                }
            });
        }

        // wait for the script adding the markup to finish, e.g. appending its <param>s
        if (wasEmpty && pending.length) {
            setTimeout(flush);
        }
    }).observe(document.documentElement, {childList: true, subtree: true});
}
