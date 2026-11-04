import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { User } from '../../domain/entities/user.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

// Loads another account the administrator may manage: it must exist and must not be the
// protected administrator.
export class ManagedAccountLoader {
    constructor(private readonly users: UserReader) {}

    async load(id: string): Promise<User> {
        const user = await this.users.findById(id);

        if (!user) {
            throw new Failure('not_found', 'That account does not exist.', 'account-missing');
        }

        user.ensureManageable();

        return user;
    }
}
