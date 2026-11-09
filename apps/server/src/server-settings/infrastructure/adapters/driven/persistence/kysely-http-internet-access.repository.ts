import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { HttpInternetAccessStore } from '../../../../application/ports/driven/http-internet-access-store.interface.js';
import { HttpInternetAccess } from '../../../../domain/entities/http-internet-access.entity.js';
import type { HttpInternetAccessState } from '../../../../domain/entities/http-internet-access.entity.js';

export class KyselyHttpInternetAccessRepository implements HttpInternetAccessStore {
    private static readonly settingName = 'http-internet-access';
    private static readonly phases = ['off', 'open'];

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<HttpInternetAccess> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', KyselyHttpInternetAccessRepository.settingName)
            .executeTakeFirst();

        if (!row) {
            return HttpInternetAccess.off();
        }

        const value: unknown = JSON.parse(row.value);

        if (
            typeof value !== 'object' ||
            value === null ||
            !('phase' in value) ||
            !KyselyHttpInternetAccessRepository.phases.includes(String(value.phase))
        ) {
            throw new Error('Saved HTTP internet access settings must contain a known phase.');
        }

        return new HttpInternetAccess({
            ...HttpInternetAccess.off().snapshot,
            ...value,
        } as HttpInternetAccessState);
    }

    async save(access: HttpInternetAccess): Promise<void> {
        const value = JSON.stringify(access.snapshot);

        await this.connections.current
            .insertInto('server_settings')
            .values({
                id: this.ids.next(),
                name: KyselyHttpInternetAccessRepository.settingName,
                value,
            })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
