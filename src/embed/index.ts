import type { IBindingConfig } from './AwayPlayerComponent';
import { observeFlashMarkup, upgradeAll } from './flashMarkup';
import { addDomLoadEvent, swfobject, SWFObject } from './swfobject';

export { AwayPlayerComponent } from './AwayPlayerComponent';
export type { IBindingConfig } from './AwayPlayerComponent';
export { swfobject, swfobject as swfObject, SWFObject };

//@ts-ignore
export const VERSION: string = "__VERSION__";

const global = <any>window;

export interface IEmbedConfig extends Partial<IBindingConfig> {
    /**
     * @description Replace Flash <object> and <embed> markup with players (default true)
     */
    autoUpgrade?: boolean;
}

/**
 * Sets options for players, the same as defining AWAY_EMBED_CFG
 */
export function configure(config: IEmbedConfig) {
    global.AWAY_EMBED_CFG = Object.assign(global.AWAY_EMBED_CFG || {}, config);
}

/**
 * Defines a global that keeps AwayFL's value if a page's own swfobject.js assigns
 * over it later, so embed.js works whether it's included before or after it
 */
function defineGlobal(name: string, value: any) {
    const existing = Object.getOwnPropertyDescriptor(window, name);

    if (existing && !existing.configurable) {
        global[name] = value;
        return;
    }

    Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (other) => {
            if (other !== value) {
                console.info(`[AwayFL] Ignoring the page's ${name}, as AwayFL provides it`);
            }
        },
    });
}

if (global.swfobject || global.swfObject || global.SWFObject) {
    console.info('[AwayFL] Replacing the page\'s SWFObject');
}

defineGlobal('swfobject', swfobject);
defineGlobal('swfObject', swfobject);
defineGlobal('SWFObject', SWFObject);

// upgrade <object>/<embed> markup, including on pages that don't use SWFObject;
// a tick later, so a module importing this can call configure() first
addDomLoadEvent(() => setTimeout(() => {
    if ((global.AWAY_EMBED_CFG || {}).autoUpgrade !== false) {
        upgradeAll();
        observeFlashMarkup();
    }
}));
