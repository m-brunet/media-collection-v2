import type { MenuItemConstructorOptions } from 'electron';
import { Menu } from 'electron';
import type { DesktopTexts } from './desktop-texts.util.js';
import type { UpdateState } from './application-updates.service.js';
import type { LaunchAtStartup } from './launch-at-startup.adapter.js';

export type UpdateMenuState = UpdateState | { kind: 'off' };

export interface ApplicationMenuActions {
    openAbout(): void;
    updates(): void;
    openMaintenance(): void;
    openConfiguration(): void;
    setLaunchAtStartup(enabled: boolean): void;
}

export class ApplicationMenu {
    constructor(
        private readonly texts: DesktopTexts,
        private readonly actions: ApplicationMenuActions,
        private readonly startup: LaunchAtStartup | undefined,
    ) {}

    build(updates: UpdateMenuState): Menu {
        return Menu.buildFromTemplate([this.file(updates), this.view(), this.maintenance()]);
    }

    private file(updates: UpdateMenuState): MenuItemConstructorOptions {
        return {
            id: 'file',
            label: this.texts.text('menuFile'),
            submenu: [
                {
                    id: 'about',
                    label: this.texts.text('menuAbout'),
                    click: () => this.actions.openAbout(),
                },
                this.updates(updates),
                ...this.launchAtStartup(),
                {
                    id: 'open-configuration',
                    label: this.texts.text('menuOpenConfiguration'),
                    click: () => this.actions.openConfiguration(),
                },
                { type: 'separator' },
                { id: 'exit', role: 'quit', label: this.texts.text('menuExit') },
            ],
        };
    }

    private updates(state: UpdateMenuState): MenuItemConstructorOptions {
        const label =
            state.kind === 'checking'
                ? this.texts.text('menuChecking')
                : state.kind === 'downloading'
                  ? this.texts.text('menuDownloading', { version: state.update.version })
                  : state.kind === 'ready'
                    ? this.texts.text('menuInstall', { version: state.update.version })
                    : this.texts.text('menuCheckForUpdates');

        return {
            id: 'updates',
            label,
            enabled: state.kind === 'idle' || state.kind === 'ready',
            click: () => this.actions.updates(),
        };
    }

    private launchAtStartup(): MenuItemConstructorOptions[] {
        if (!this.startup) {
            return [];
        }

        return [
            {
                id: 'launch-at-startup',
                type: 'checkbox',
                label: this.texts.text('menuLaunchAtStartup'),
                checked: this.startup.enabled(),
                enabled: this.startup.available,
                click: (item) => this.actions.setLaunchAtStartup(item.checked),
            },
        ];
    }

    private view(): MenuItemConstructorOptions {
        return {
            id: 'view',
            label: this.texts.text('menuView'),
            submenu: [
                { role: 'reload', label: this.texts.text('menuReload') },
                { role: 'forceReload', label: this.texts.text('menuForceReload') },
                { role: 'toggleDevTools', label: this.texts.text('menuDeveloperTools') },
                { type: 'separator' },
                { role: 'resetZoom', label: this.texts.text('menuActualSize') },
                { role: 'zoomIn', label: this.texts.text('menuZoomIn') },
                { role: 'zoomOut', label: this.texts.text('menuZoomOut') },
                { type: 'separator' },
                { role: 'togglefullscreen', label: this.texts.text('menuFullScreen') },
            ],
        };
    }

    private maintenance(): MenuItemConstructorOptions {
        return {
            id: 'maintenance',
            label: this.texts.text('menuMaintenance'),
            submenu: [
                {
                    id: 'local-maintenance',
                    label: this.texts.text('menuOpenMaintenance'),
                    click: () => this.actions.openMaintenance(),
                },
            ],
        };
    }
}
