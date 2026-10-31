import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';

export class SessionSigningKey {
    constructor(private readonly storage: PrivateStorage) {}

    load(directory: string): Buffer {
        const file = join(directory, 'session.key');

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
}
