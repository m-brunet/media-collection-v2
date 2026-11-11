import { randomBytes } from 'node:crypto';
import type { BrowserWindow } from 'electron';

export class SetupRequestSigner {
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
