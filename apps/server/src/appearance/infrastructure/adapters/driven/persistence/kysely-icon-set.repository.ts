import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { IconSetStore } from '../../../../application/ports/driven/icon-set-store.interface.js';
import { IconSet } from '../../../../domain/value-objects/icon-set.value-object.js';

export class KyselyIconSetRepository implements IconSetStore {
    private static readonly settingName = 'icon-set';

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<IconSet> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', KyselyIconSetRepository.settingName)
            .executeTakeFirst();

        if (!row) {
            return IconSet.default;
        }

        const value: unknown = JSON.parse(row.value);

        if (typeof value !== 'object' || value === null || !('iconSet' in value)) {
            throw new Error('Saved icon set setting must contain an icon set.');
        }

        return new IconSet(String(value.iconSet));
    }

    async save(set: IconSet): Promise<void> {
        const value = JSON.stringify({ iconSet: set.name });

        await this.connections.current
            .insertInto('server_settings')
            .values({ id: this.ids.next(), name: KyselyIconSetRepository.settingName, value })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
