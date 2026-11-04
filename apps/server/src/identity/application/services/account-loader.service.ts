import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { User } from '../../domain/entities/user.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

// Loads the signed-in account. A missing or deactivated account has no valid session.
export class AccountLoader {
    constructor(private readonly users: UserReader) {}

    async load(id: string): Promise<User> {
        const user = await this.users.findById(id);

        if (!user || !user.isActive) {
            throw new Failure('unauthorized', 'Sign in again.', 'session-ended');
        }

        return user;
    }
}
