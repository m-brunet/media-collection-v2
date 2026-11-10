import type { IpcMainInvokeEvent } from 'electron';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import type { DesktopTexts } from './desktop-texts.util.js';
import { ProjectLinks } from './project-links.util.js';

interface AboutWindowOptions {
    preloadPath: string;
    pagePath: string;
    iconPath: string;
    hidden: boolean;
    texts: DesktopTexts;
    // Shows the credits and licences page in the Libris window.
    openCredits(): void;
}

// The About window: version, project links and the credits page. One at a time; the page only
// names a target, the addresses stay here.
export class AboutWindow {
    private static readonly channel = 'about:open';
    private window: BrowserWindow | undefined;

    constructor(private readonly options: AboutWindowOptions) {}

    async open(parent: BrowserWindow | undefined): Promise<void> {
        if (this.window && !this.window.isDestroyed()) {
            this.window.focus();

            return;
        }

        const window = new BrowserWindow({
            width: 440,
            height: 460,
            resizable: false,
            minimizable: false,
            maximizable: false,
            parent,
            title: this.options.texts.text('aboutWindowTitle'),
            icon: this.options.iconPath,
            backgroundColor: '#1d2022',
            show: !this.options.hidden,
            webPreferences: {
                backgroundThrottling: !this.options.hidden,
                preload: this.options.preloadPath,
                additionalArguments: [
                    '--mc-language=' + this.options.texts.language,
                    '--mc-version=' + app.getVersion(),
                ],
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
            },
        });

        this.window = window;
        window.setMenuBarVisibility(false);
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', (event) => event.preventDefault());
        window.webContents.on('will-attach-webview', (event) => event.preventDefault());
        ipcMain.removeHandler(AboutWindow.channel);
        ipcMain.handle(AboutWindow.channel, (event, target: unknown) => this.follow(event, target));
        window.once('closed', () => {
            ipcMain.removeHandler(AboutWindow.channel);
            this.window = undefined;
        });
        await window.loadFile(this.options.pagePath);
    }

    private async follow(event: IpcMainInvokeEvent, target: unknown): Promise<boolean> {
        if (
            event.sender !== this.window?.webContents ||
            event.senderFrame !== this.window.webContents.mainFrame
        ) {
            return false;
        }

        if (target === 'repository') {
            await shell.openExternal(ProjectLinks.repository);
        } else if (target === 'licence') {
            await shell.openExternal(ProjectLinks.licence);
        } else if (target === 'credits') {
            this.options.openCredits();
        } else {
            return false;
        }

        return true;
    }
}
