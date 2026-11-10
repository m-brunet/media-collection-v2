import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { TlsCertificateReader } from '../../../../application/ports/driven/tls-certificate-reader.interface.js';
import type { TlsStore } from '../../../../application/ports/driven/tls-store.interface.js';
import type {
    TlsSettings,
    TlsSettingsState,
} from '../../../../domain/value-objects/tls-settings.value-object.js';

interface StoredSettings extends TlsSettingsState {
    certificateDirectory?: string;
    revision: string;
}

export class FileTlsStore implements TlsStore, TlsCertificateReader {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly directory: string,
        private readonly storage: PrivateStorage,
        private readonly ids: IdGenerator,
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

        await this.connections.current
            .insertInto('server_settings')
            .values({ id: this.ids.next(), name: 'tls', value })
            .onConflict((c) => c.column('name').doUpdateSet({ value }))
            .execute();
    }

    async material(): Promise<{ cert: Buffer; key: Buffer }> {
        const directory = this.certificateDirectory(await this.stored());

        if (!directory) {
            throw new Error('Saved certificate material is missing.');
        }

        return {
            cert: readFileSync(join(directory, 'chain.pem')),
            key: readFileSync(join(directory, 'key.pem')),
        };
    }

    async currentChain(): Promise<string | null> {
        const directory = this.certificateDirectory(await this.stored());

        return directory ? readFileSync(join(directory, 'chain.pem'), 'utf8') : null;
    }

    private certificateDirectory(saved: StoredSettings): string | null {
        if (!saved.certificateDirectory || !/^[a-f0-9-]{36}$/.test(saved.certificateDirectory)) {
            return null;
        }

        return resolve(this.directory, 'tls', saved.certificateDirectory);
    }

    private async stored(): Promise<StoredSettings> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .selectAll()
            .where('name', '=', 'tls')
            .executeTakeFirst();

        return row
            ? (JSON.parse(row.value) as StoredSettings)
            : { enabled: false, port: 3443, hasCertificate: false, revision: 'initial' };
    }
}
