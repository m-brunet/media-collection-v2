import type { FindProtectedAdministratorUseCase } from '../ports/driving/find-protected-administrator-use-case.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';

export class FindProtectedAdministrator implements FindProtectedAdministratorUseCase {
    constructor(private readonly users: UserReader) {}

    async execute(): Promise<{ username: string } | null> {
        const administrator = (await this.users.list()).find(
            (user) => user.isProtectedAdministrator,
        );

        return administrator ? { username: administrator.actor.username } : null;
    }
}
