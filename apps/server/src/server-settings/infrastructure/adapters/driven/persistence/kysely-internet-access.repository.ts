import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { InternetAccessStore } from '../../../../application/ports/driven/internet-access-store.interface.js';
import { InternetAccess } from '../../../../domain/entities/internet-access.entity.js';
import type { InternetAccessState } from '../../../../domain/entities/internet-access.entity.js';

export class KyselyInternetAccessRepository implements InternetAccessStore {
    private static readonly settingName = 'internet-access';
    private static readonly phases = ['off', 'setting-up', 'waiting-for-port', 'active'];

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<InternetAccess> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', KyselyInternetAccessRepository.settingName)
            .executeTakeFirst();

        if (!row) {
            return InternetAccess.off();
        }

        const value: unknown = JSON.parse(row.value);

        if (
            typeof value !== 'object' ||
            value === null ||
            !('phase' in value) ||
            !KyselyInternetAccessRepository.phases.includes(String(value.phase))
        ) {
            throw new Error('Saved internet access settings must contain a known phase.');
        }

        return new InternetAccess({
            ...InternetAccess.off().snapshot,
            ...value,
        } as InternetAccessState);
    }

    async save(access: InternetAccess): Promise<void> {
        const value = JSON.stringify(access.snapshot);

        await this.connections.current
            .insertInto('server_settings')
            .values({
                id: this.ids.next(),
                name: KyselyInternetAccessRepository.settingName,
                value,
            })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
