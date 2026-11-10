import type { LibraryAdministrator } from '../../../development-data/application/ports/driven/library-administrator.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';

export class LibraryAdministratorLookup implements LibraryAdministrator {
    constructor(private readonly users: UserReader) {}

    async find(): Promise<Actor | null> {
        const users = await this.users.list();
        const administrator = users.find((user) => user.isProtectedAdministrator && user.isActive);

        return administrator?.actor ?? null;
    }
}
