import electronUpdater from 'electron-updater';
import type { AvailableUpdate, UpdateSource } from './application-updates.service.js';
import { ProjectLinks } from './project-links.util.js';

// The published GitHub Releases, through electron-updater: stable versions only, the download is
// checked against the SHA-512 of the release's `latest.yml`, and nothing happens on its own.
export class ElectronUpdaterSource implements UpdateSource {
    readonly integratedInstall = process.platform === 'win32';
    private readonly updater = electronUpdater.autoUpdater;

    constructor() {
        this.updater.autoDownload = false;
        this.updater.autoInstallOnAppQuit = false;
        this.updater.allowPrerelease = false;
        this.updater.allowDowngrade = false;
    }

    async check(): Promise<AvailableUpdate | null> {
        const result = await this.updater.checkForUpdates();

        if (!result?.isUpdateAvailable) {
            return null;
        }

        const version = result.updateInfo.version;

        return { version, releasePage: ProjectLinks.releases + '/tag/v' + version };
    }

    async download(): Promise<void> {
        await this.updater.downloadUpdate();
    }

    install(): void {
        // Silent installer (the administrator prompt still appears), then the new version starts.
        this.updater.quitAndInstall(true, true);
    }
}
