import { EventEmitter } from 'node:events';
import type { DisplayBalloonOptions, Menu } from 'electron';
import type { TrayIcon } from './desktop-tray.adapter.js';

export interface ShownBalloon {
    title: string;
    content: string;
}

export class HiddenTray extends EventEmitter implements TrayIcon {
    static readonly created: HiddenTray[] = [];
    toolTip = '';
    menu: Menu | null = null;
    readonly balloons: ShownBalloon[] = [];

    constructor() {
        super();
        HiddenTray.created.push(this);
    }

    static latest(): HiddenTray | undefined {
        return HiddenTray.created.at(-1);
    }

    setToolTip(toolTip: string): void {
        this.toolTip = toolTip;
    }

    setContextMenu(menu: Menu): void {
        this.menu = menu;
    }

    displayBalloon(options: DisplayBalloonOptions): void {
        this.balloons.push({ title: options.title, content: options.content });
    }

    destroy(): void {
        this.removeAllListeners();
    }
}
