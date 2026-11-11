import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class TrayNotice {
    private readonly marker: string;

    constructor(directory: string) {
        this.marker = join(directory, 'tray-notice-shown');
    }

    due(): boolean {
        return !existsSync(this.marker);
    }

    shown(): void {
        writeFileSync(this.marker, '');
    }
}
