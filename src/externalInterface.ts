import { ExternalInterfaceService } from "@awayfl/swf-loader";

/**
 * Connects ExternalInterface to the page embedding the player, as the Flash
 * plugin did. The player runs in a same-origin srcdoc iframe, so calls stay
 * synchronous and keep their return values in both directions:
 * - ExternalInterface.call() is evaluated in the page's global scope
 * - ExternalInterface.addCallback() functions become methods of the
 *   <awayfl-player> element, e.g. swfobject.getObjectById(id).myCallback()
 */
export function bridgeExternalInterface() {
    const frame = window.frameElement;

    if (!frame) {
        return;
    }

    const page = <any>frame.ownerDocument.defaultView;
    // the iframe is inside the player element's shadow root
    const host = (<any>frame.getRootNode()).host || frame;
    // a unique global in the page for the __flash__toXML helper ExternalInterface.call() uses
    const id = '__awayfl_ei_' + Math.random().toString(36).slice(2);

    ExternalInterfaceService.interfaceID = id;
    ExternalInterfaceService.ensureInit();
    page[id] = window[id];
    window.addEventListener('pagehide', () => delete page[id]);

    ExternalInterfaceService.eval = (expression: string) => {
        try {
            return page.eval(expression);
        } catch (e) {
            console.warn('[ExternalInterface] call failed:\n', expression, '\n' + e.message);
        }
    };

    ExternalInterfaceService.getId = () => host.id || null;

    const registerCallback = ExternalInterfaceService.registerCallback;
    const unregisterCallback = ExternalInterfaceService.unregisterCallback;

    // return values are created in the iframe, so copy them into the page's realm
    const toPage = (value: any) => {
        try {
            return page.structuredClone(value);
        } catch (e) {
            return value;
        }
    };

    ExternalInterfaceService.registerCallback = (functionName: string) => {
        registerCallback(functionName);

        const callback = window[id][functionName];
        host[functionName] = (...args: any[]) => toPage(callback(...args));
    };

    ExternalInterfaceService.unregisterCallback = (functionName: string) => {
        unregisterCallback(functionName);
        delete host[functionName];
    };
}
