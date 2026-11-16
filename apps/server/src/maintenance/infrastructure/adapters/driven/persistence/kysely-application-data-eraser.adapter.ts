import type { ApplicationDataEraser } from '../../../../application/ports/driven/application-data-eraser.interface.js';
import type { LibraryEraser } from '../../../../application/ports/driven/library-eraser.interface.js';
import type { KeptCoverStore } from '../../../../../books/application/ports/driven/kept-cover-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyApplicationDataEraser implements ApplicationDataEraser {
    private static readonly preferences = ['appearance', 'icon-set'];

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly library: LibraryEraser,
        private readonly kept: KeptCoverStore,
    ) {}

    async erase(keptAccountId: string, deleteKeptCovers: boolean): Promise<void> {
        const db = this.connections.current;

        await this.library.erase();

        if (deleteKeptCovers) {
            await this.kept.clear();
        }

        await db.deleteFrom('users').where('id', '!=', keptAccountId).execute();
        await db
            .deleteFrom('server_settings')
            .where('name', 'in', KyselyApplicationDataEraser.preferences)
            .execute();
    }
}
