import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { DomainNameStore } from '../../../../application/ports/driven/domain-name-store.interface.js';
import { DomainName } from '../../../../domain/value-objects/domain-name.value-object.js';

export class KyselyDomainNameRepository implements DomainNameStore {
    private static readonly settingName = 'domain-name';

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<string | null> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', KyselyDomainNameRepository.settingName)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        const value: unknown = JSON.parse(row.value);

        if (
            typeof value !== 'object' ||
            value === null ||
            !('name' in value) ||
            (value.name !== null && typeof value.name !== 'string')
        ) {
            throw new Error('The saved domain name setting must hold a name or null.');
        }

        const name = value.name === null ? null : DomainName.optional(value.name);

        return name ? name.value : null;
    }

    async save(name: DomainName | null): Promise<void> {
        const value = JSON.stringify({ name: name ? name.value : null });

        await this.connections.current
            .insertInto('server_settings')
            .values({ id: this.ids.next(), name: KyselyDomainNameRepository.settingName, value })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
