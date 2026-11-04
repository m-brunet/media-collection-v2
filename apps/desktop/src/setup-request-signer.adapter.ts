import { randomBytes } from 'node:crypto';
import type { BrowserWindow } from 'electron';

// Reserves first-launch setup to this desktop window. The secret lives only in this process and
// the backend it starts; it is attached to the window's own setup requests and never exposed to
// the page, so browsers (even on the same computer) cannot complete setup.
export class SetupRequestSigner {
    // Must match the header the backend's SetupAccess checks.
    private static readonly header = 'X-Media-Collection-Setup';
    readonly secret = randomBytes(32).toString('base64url');

    attach(window: BrowserWindow, origin: string): void {
        const contents = window.webContents.id;

        window.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
            const setup =
                details.webContentsId === contents && details.url.startsWith(origin + '/api/setup');

            callback({
                requestHeaders: setup
                    ? { ...details.requestHeaders, [SetupRequestSigner.header]: this.secret }
                    : details.requestHeaders,
            });
        });
    }
}
