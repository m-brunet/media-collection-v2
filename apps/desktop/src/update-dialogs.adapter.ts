import type { MessageBoxOptions } from 'electron';
import { app, dialog } from 'electron';
import type { AvailableUpdate, UpdateDialogs } from './application-updates.service.js';
import type { DesktopTexts } from './desktop-texts.util.js';

export class NativeUpdateDialogs implements UpdateDialogs {
    constructor(private readonly texts: DesktopTexts) {}

    async upToDate(): Promise<void> {
        await this.ask({
            type: 'info',
            message: this.texts.text('upToDateMessage', { version: app.getVersion() }),
            buttons: [this.texts.text('ok')],
        });
    }

    available(update: AvailableUpdate, integratedInstall: boolean): Promise<boolean> {
        return this.ask({
            type: 'info',
            message: this.texts.text('availableMessage', { version: update.version }),
            detail: this.texts.text(
                integratedInstall ? 'availableDetailIntegrated' : 'availableDetailManual',
            ),
            buttons: [
                this.texts.text(integratedInstall ? 'download' : 'backupAndOpen'),
                this.texts.text('later'),
            ],
        });
    }

    checkFailed(message: string): Promise<boolean> {
        return this.ask({
            type: 'warning',
            message: this.texts.text('checkFailedMessage'),
            detail: this.texts.text('checkFailedDetail', { message }),
            buttons: [this.texts.text('retry'), this.texts.text('close')],
        });
    }

    downloadFailed(update: AvailableUpdate, message: string): Promise<boolean> {
        return this.ask({
            type: 'warning',
            message: this.texts.text('downloadFailedMessage', { version: update.version }),
            detail: this.texts.text('checkFailedDetail', { message }),
            buttons: [this.texts.text('retry'), this.texts.text('close')],
        });
    }

    ready(update: AvailableUpdate): Promise<boolean> {
        return this.ask({
            type: 'question',
            message: this.texts.text('readyMessage', { version: update.version }),
            detail: this.texts.text('readyDetail'),
            buttons: [this.texts.text('restartAndInstall'), this.texts.text('later')],
        });
    }

    backupFailed(message: string): Promise<boolean> {
        return this.ask({
            type: 'error',
            message: this.texts.text('backupFailedMessage'),
            detail: this.texts.text('backupFailedDetail', { message }),
            buttons: [this.texts.text('retry'), this.texts.text('cancel')],
        });
    }

    private async ask(
        options: Omit<MessageBoxOptions, 'title'> & { buttons: string[] },
    ): Promise<boolean> {
        const result = await dialog.showMessageBox({
            ...options,
            title: this.texts.text('updateTitle'),
            defaultId: 0,
            cancelId: options.buttons.length - 1,
            noLink: true,
        });

        return result.response === 0;
    }
}
