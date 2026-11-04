import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { AppearanceStore } from '../../../../application/ports/driven/appearance-store.interface.js';
import { ColorScheme } from '../../../../domain/value-objects/color-scheme.value-object.js';

// Saved with the other application preferences in `server_settings`, under `appearance`.
export class KyselyAppearanceRepository implements AppearanceStore {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async read(): Promise<ColorScheme> {
        const row = await this.connections.current
            .selectFrom('server_settings')
            .select('value')
            .where('name', '=', 'appearance')
            .executeTakeFirst();

        if (!row) {
            return ColorScheme.default;
        }

        const value: unknown = JSON.parse(row.value);

        if (typeof value !== 'object' || value === null || !('colorScheme' in value)) {
            throw new Error('Saved appearance must contain a colour scheme.');
        }

        return new ColorScheme(String(value.colorScheme));
    }

    async save(scheme: ColorScheme): Promise<void> {
        const value = JSON.stringify({ colorScheme: scheme.name });

        await this.connections.current
            .insertInto('server_settings')
            .values({ id: this.ids.next(), name: 'appearance', value })
            .onConflict((conflict) => conflict.column('name').doUpdateSet({ value }))
            .execute();
    }
}
