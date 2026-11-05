import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UuidGenerator } from '../../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { Database } from '../../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';

export class DatabaseManager {
    private directory?: string;
    private database?: Database;

    async setup(): Promise<{ database: Database; directory: string }> {
        this.directory = await mkdtemp(join(tmpdir(), 'controller-api-'));
        this.database = await Database.open(this.directory, new UuidGenerator());

        return { database: this.database, directory: this.directory };
    }

    async teardown(): Promise<void> {
        try {
            await this.database?.close();
        } finally {
            this.database = undefined;

            if (this.directory) {
                await rm(this.directory, { recursive: true, force: true });
            }

            this.directory = undefined;
        }
    }
}
