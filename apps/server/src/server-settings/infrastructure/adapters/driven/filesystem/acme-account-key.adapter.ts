import acme from 'acme-client';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';

// The Let's Encrypt account key, created on first use and kept with the other protected keys.
export class AcmeAccountKey {
    private static readonly fileName = 'acme-account.key';

    constructor(
        private readonly directory: string,
        private readonly storage: PrivateStorage,
    ) {}

    async load(): Promise<Buffer> {
        const file = join(this.directory, AcmeAccountKey.fileName);

        try {
            writeFileSync(file, await acme.crypto.createPrivateEcdsaKey(), {
                flag: 'wx',
                mode: 0o600,
            });
        } catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
                throw error;
            }
        }

        this.storage.restrict(file);

        return readFileSync(file);
    }
}
