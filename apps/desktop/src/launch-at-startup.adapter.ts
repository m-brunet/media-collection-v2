import { app } from 'electron';

// Windows reads the per-user Run key at sign-in. Electron writes the value as
// `"<executable>" --hidden` under the given name; build/installer.nsh writes the same value.
export class LaunchAtStartup {
    static readonly argument = '--hidden';
    static readonly entryName = 'Media Collection';

    constructor(readonly available: boolean) {}

    enabled(): boolean {
        return (
            this.available &&
            app.getLoginItemSettings({ args: [LaunchAtStartup.argument] })
                .executableWillLaunchAtLogin
        );
    }

    set(enabled: boolean): void {
        if (!this.available) {
            return;
        }

        app.setLoginItemSettings({
            openAtLogin: enabled,
            args: [LaunchAtStartup.argument],
            name: LaunchAtStartup.entryName,
        });
    }
}
