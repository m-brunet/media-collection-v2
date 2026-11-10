import { powerSaveBlocker } from 'electron';

// The screen may still turn off.
export class KeepAwake {
    private blocker: number | undefined;

    apply(enabled: boolean): void {
        if (enabled && this.blocker === undefined) {
            this.blocker = powerSaveBlocker.start('prevent-app-suspension');
        } else if (!enabled) {
            this.release();
        }
    }

    release(): void {
        if (this.blocker !== undefined) {
            powerSaveBlocker.stop(this.blocker);
            this.blocker = undefined;
        }
    }
}
