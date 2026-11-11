import { Menu, Tray } from 'electron';
import type { DesktopTexts } from './desktop-texts.util.js';
import type { LaunchAtStartup } from './launch-at-startup.adapter.js';

export interface DesktopTrayActions {
    open(): void;
    setLaunchAtStartup(enabled: boolean): void;
    quit(): void;
}

export class DesktopTray {
    private tray: Tray | undefined;

    constructor(
        private readonly texts: DesktopTexts,
        private readonly iconPath: string,
        private readonly startup: LaunchAtStartup,
        private readonly actions: DesktopTrayActions,
    ) {}

    show(): void {
        if (this.tray) {
            return;
        }

        this.tray = new Tray(this.iconPath);
        this.tray.setToolTip(this.texts.text('trayTooltip'));
        this.tray.on('click', () => this.actions.open());
        this.refresh();
    }

    refresh(): void {
        this.tray?.setContextMenu(
            Menu.buildFromTemplate([
                {
                    id: 'open',
                    label: this.texts.text('trayOpen'),
                    click: () => this.actions.open(),
                },
                {
                    id: 'launch-at-startup',
                    type: 'checkbox',
                    label: this.texts.text('menuLaunchAtStartup'),
                    checked: this.startup.enabled(),
                    enabled: this.startup.available,
                    click: (item) => this.actions.setLaunchAtStartup(item.checked),
                },
                { type: 'separator' },
                { id: 'quit', label: this.texts.text('quit'), click: () => this.actions.quit() },
            ]),
        );
    }

    notifyKeepsRunning(): void {
        this.tray?.displayBalloon({
            title: this.texts.text('trayTooltip'),
            content: this.texts.text('trayKeepsRunning'),
            iconType: 'info',
        });
    }

    destroy(): void {
        this.tray?.destroy();
        this.tray = undefined;
    }
}
