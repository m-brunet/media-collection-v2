import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { HttpSettingsStore } from '../../../../application/ports/driven/http-settings-store.interface.js';
import { HttpSettings } from '../../../../domain/value-objects/http-settings.value-object.js';

export class KyselyHttpSettingsRepository implements HttpSettingsStore {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async read(): Promise<HttpSettings> {
        const row = await this.db
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', 'http')
            .executeTakeFirst();

        if (!row) {
            return new HttpSettings(34345);
        }

        const value: unknown = JSON.parse(row.value);

        if (
            typeof value !== 'object' ||
            value === null ||
            !('port' in value) ||
            typeof value.port !== 'number'
        ) {
            throw new Error('Saved HTTP settings must contain a numeric port.');
        }

        return new HttpSettings(value.port);
    }

    async save(settings: HttpSettings): Promise<void> {
        const value = JSON.stringify(settings.snapshot());

        await this.db
            .insertInto('server_settings')
            .values({ name: 'http', value })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
