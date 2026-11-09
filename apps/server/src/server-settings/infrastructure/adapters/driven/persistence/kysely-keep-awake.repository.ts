import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { KeepAwakeStore } from '../../../../application/ports/driven/keep-awake-store.interface.js';

export class KyselyKeepAwakeRepository implements KeepAwakeStore {
    private static readonly settingName = 'keep-awake';

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<boolean> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', KyselyKeepAwakeRepository.settingName)
            .executeTakeFirst();

        if (!row) {
            return false;
        }

        const value: unknown = JSON.parse(row.value);

        if (
            typeof value !== 'object' ||
            value === null ||
            !('enabled' in value) ||
            typeof value.enabled !== 'boolean'
        ) {
            throw new Error('Saved keep-awake setting must be true or false.');
        }

        return value.enabled;
    }

    async save(enabled: boolean): Promise<void> {
        const value = JSON.stringify({ enabled });

        await this.connections.current
            .insertInto('server_settings')
            .values({ id: this.ids.next(), name: KyselyKeepAwakeRepository.settingName, value })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
