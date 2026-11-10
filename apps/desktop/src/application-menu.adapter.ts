import type { MenuItemConstructorOptions } from 'electron';
import { Menu } from 'electron';
import type { DesktopTexts } from './desktop-texts.util.js';

export interface ApplicationMenuActions {
    openMaintenance(): void;
}

// Windows and Linux menus: File, View and Maintenance. No Edit menu: copy, cut, paste and select
// all work in text fields without it on these systems.
export class ApplicationMenu {
    constructor(
        private readonly texts: DesktopTexts,
        private readonly actions: ApplicationMenuActions,
    ) {}

    build(): Menu {
        return Menu.buildFromTemplate([this.file(), this.view(), this.maintenance()]);
    }

    private file(): MenuItemConstructorOptions {
        return {
            id: 'file',
            label: this.texts.text('menuFile'),
            submenu: [{ id: 'exit', role: 'quit', label: this.texts.text('menuExit') }],
        };
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
