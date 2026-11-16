import type { ApplicationDataEraser } from '../../../../application/ports/driven/application-data-eraser.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { KyselyLibraryEraser } from './kysely-library-eraser.adapter.js';

export class KyselyApplicationDataEraser implements ApplicationDataEraser {
    private static readonly preferences = ['appearance', 'icon-set'];

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly library: KyselyLibraryEraser,
    ) {}

    async erase(keptAccountId: string, deleteKeptCovers: boolean): Promise<void> {
        const db = this.connections.current;

        await this.library.erase();

        if (deleteKeptCovers) {
            await db.deleteFrom('kept_covers').execute();
        }

        await db.deleteFrom('users').where('id', '!=', keptAccountId).execute();
        await db
            .deleteFrom('server_settings')
            .where('name', 'in', KyselyApplicationDataEraser.preferences)
            .execute();
    }
}
