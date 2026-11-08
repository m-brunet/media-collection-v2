import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';

export class SessionSigningKey {
    constructor(private readonly storage: PrivateStorage) {}

    private static readonly fileName = 'session.key';

    load(directory: string): Buffer {
        const file = join(directory, SessionSigningKey.fileName);

        try {
            writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
        } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
                throw error;
            }
        }

        this.storage.restrict(file);
        const key = readFileSync(file);

        if (key.length !== 32) {
            throw new Error('The saved session signing key is invalid.');
        }

        return key;
    }

    // A new key: every session signed with the previous one ends.
    rotate(directory: string): void {
        const file = join(directory, SessionSigningKey.fileName);

        writeFileSync(file, randomBytes(32), { mode: 0o600 });
        this.storage.restrict(file);
    }
}
