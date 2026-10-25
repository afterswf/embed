import { observeFlashMarkup, upgradeAll } from './flashMarkup';
import { addDomLoadEvent, swfobject, SWFObject } from './swfobject';

const global = <any>window;

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

// upgrade <object>/<embed> markup, including on pages that don't use SWFObject
addDomLoadEvent(() => {
    if ((global.AWAY_EMBED_CFG || {}).autoUpgrade !== false) {
        upgradeAll();
        observeFlashMarkup();
    }
});
