import { app } from 'electron';
import { setTimeout as delay } from 'node:timers/promises';
import type { AvailableUpdate, UpdateSource } from './application-updates.service.js';
import { ProjectLinks } from './project-links.util.js';

export interface UpdateScript {
    // The latest published version; `null` when the running one is the latest.
    latest: string | null;
    system: 'windows' | 'linux';
    failCheck?: boolean;
    failDownload?: boolean;
    // How long the download takes, in milliseconds.
    downloadMs?: number;
}

// Updates without GitHub, for test launches (`APP_TEST_UPDATES`): the script says what the
// releases contain. Installing quits the application, as the real installer does.
export class ScriptedUpdateSource implements UpdateSource {
    readonly integratedInstall: boolean;

    constructor(private readonly script: UpdateScript) {
        this.integratedInstall = script.system === 'windows';
    }

    static fromEnvironment(value: string | undefined): ScriptedUpdateSource | undefined {
        return value ? new ScriptedUpdateSource(JSON.parse(value) as UpdateScript) : undefined;
    }

    async check(): Promise<AvailableUpdate | null> {
        if (this.script.failCheck) {
            throw new Error('The releases could not be read.');
        }

        const version = this.script.latest;

        return version
            ? { version, releasePage: ProjectLinks.releases + '/tag/v' + version }
            : null;
    }

    async download(): Promise<void> {
        await delay(this.script.downloadMs ?? 0);

        if (this.script.failDownload) {
            throw new Error('The download stopped.');
        }
    }

    install(): void {
        app.quit();
    }
}
