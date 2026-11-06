import type { LibraryAdministrator } from '../../../../application/ports/driven/library-administrator.interface.js';
import type { Actor, InterfaceLanguage } from '../../../../../shared/domain/actor.helper.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Reads the protected administrator account from the users table.
export class KyselyLibraryAdministrator implements LibraryAdministrator {
    constructor(private readonly connections: DatabaseConnections) {}

    async find(): Promise<Actor | null> {
        const row = await this.connections.current
            .selectFrom('users')
            .select(['id', 'username', 'must_change_password', 'language', 'token_version'])
            .where('role', '=', 'admin')
            .where('active', '=', 1)
            .executeTakeFirst();

        return row
            ? {
                  id: row.id,
                  username: row.username,
                  role: 'admin',
                  mustChangePassword: row.must_change_password === 1,
                  language: KyselyLibraryAdministrator.language(row.language),
                  sessionVersion: row.token_version,
              }
            : null;
    }

    private static language(value: string | null): InterfaceLanguage | null {
        return value === 'en' || value === 'fr' ? value : null;
    }
}
