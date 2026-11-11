export class BackgroundMode {
    private revealed: boolean;

    constructor(
        private readonly tray: boolean,
        startedHidden: boolean,
    ) {
        this.revealed = !(tray && startedHidden);
    }

    revealsOnLaunch(): boolean {
        const reveals = this.revealed;

        this.revealed = true;

        return reveals;
    }

    keepsRunningOnClose(quitRequested: boolean): boolean {
        return this.tray && !quitRequested;
    }
}
