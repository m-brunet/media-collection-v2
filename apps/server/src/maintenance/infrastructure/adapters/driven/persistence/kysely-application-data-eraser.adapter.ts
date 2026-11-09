import type { ApplicationDataEraser } from '../../../../application/ports/driven/application-data-eraser.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import type { KyselyLibraryEraser } from './kysely-library-eraser.adapter.js';

// The saved application preferences (colour scheme, icon set) return to their defaults; the HTTP, HTTPS, internet access
// (HTTPS and HTTP), domain name and keep-awake settings are host setup and stay.
export class KyselyApplicationDataEraser implements ApplicationDataEraser {
    private static readonly preferences = ['appearance', 'icon-set'];

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly library: KyselyLibraryEraser,
    ) {}

    async erase(keptAccountId: string): Promise<void> {
        const db = this.connections.current;

        await this.library.erase();
        await db.deleteFrom('users').where('id', '!=', keptAccountId).execute();
        await db
            .deleteFrom('server_settings')
            .where('name', 'in', KyselyApplicationDataEraser.preferences)
            .execute();
    }
}
