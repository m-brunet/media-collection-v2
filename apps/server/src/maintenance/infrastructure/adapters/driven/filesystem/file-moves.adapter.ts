import { rename } from 'node:fs/promises';

export class FileMoves {
    move(from: string, to: string): Promise<void> {
        return rename(from, to);
    }
}
