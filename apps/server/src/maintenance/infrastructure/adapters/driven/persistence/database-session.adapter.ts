import { Database } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';

export class DatabaseSession {
    constructor(
        private readonly directory: string,
        private readonly ids: IdGenerator,
    ) {}

    async use<T>(work: (connections: DatabaseConnections) => Promise<T>): Promise<T> {
        const database = await Database.open(this.directory, this.ids);

        try {
            return await work(database.connections);
        } finally {
            await database.close();
        }
    }
}
