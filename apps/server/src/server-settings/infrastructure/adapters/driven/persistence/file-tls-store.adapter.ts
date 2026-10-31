import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import type { Kysely } from 'kysely';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { TlsStore } from '../../../../application/ports/driven/tls-store.interface.js';
import type {
    TlsSettings,
    TlsSettingsState,
} from '../../../../domain/value-objects/tls-settings.value-object.js';

interface StoredSettings extends TlsSettingsState {
    certificateDirectory?: string;
    revision: string;
}

export class FileTlsStore implements TlsStore {
    constructor(
        private readonly db: Kysely<DatabaseSchema>,
        private readonly directory: string,
        private readonly storage: PrivateStorage,
    ) {}

    async read(): Promise<TlsSettingsState> {
        const { enabled, port, hasCertificate } = await this.stored();

        return { enabled, port, hasCertificate };
    }

    async revision(): Promise<string> {
        return (await this.stored()).revision;
    }

    async save(settings: TlsSettings, certificate?: { chain: string; key: string }): Promise<void> {
        const previous = await this.stored();
        let certificateDirectory = previous.certificateDirectory;

        if (certificate) {
            certificateDirectory = randomUUID();
            const destination = join(this.directory, 'tls', certificateDirectory);

            mkdirSync(destination, { recursive: true, mode: 0o700 });
            this.storage.restrict(destination, true);
            writeFileSync(join(destination, 'chain.pem'), certificate.chain, {
                flag: 'wx',
                mode: 0o600,
            });
            writeFileSync(join(destination, 'key.pem'), certificate.key, {
                flag: 'wx',
                mode: 0o600,
            });
        }

        const value = JSON.stringify({
            ...settings.snapshot(),
            certificateDirectory,
            revision: randomUUID(),
        });

        await this.db
            .insertInto('server_settings')
            .values({ name: 'tls', value })
            .onConflict((c) => c.column('name').doUpdateSet({ value }))
            .execute();
    }

    async material(): Promise<{ cert: Buffer; key: Buffer }> {
        const saved = await this.stored();

        if (!saved.certificateDirectory || !/^[a-f0-9-]{36}$/.test(saved.certificateDirectory)) {
            throw new Error('Saved certificate material is missing.');
        }

        const directory = resolve(this.directory, 'tls', saved.certificateDirectory);

        return {
            cert: readFileSync(join(directory, 'chain.pem')),
            key: readFileSync(join(directory, 'key.pem')),
        };
    }

    private async stored(): Promise<StoredSettings> {
        const row = await this.db
            .selectFrom('server_settings')
            .selectAll()
            .where('name', '=', 'tls')
            .executeTakeFirst();

        return row
            ? (JSON.parse(row.value) as StoredSettings)
            : { enabled: false, port: 3443, hasCertificate: false, revision: 'initial' };
    }
}
