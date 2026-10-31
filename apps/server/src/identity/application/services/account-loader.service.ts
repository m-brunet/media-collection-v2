import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { User } from '../../domain/entities/user.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class AccountLoader {
    constructor(private readonly users: UserReader) {}

    async load(id: string): Promise<User> {
        const user = await this.users.findById(id);

        if (!user) {
            throw new Failure('unauthorized', 'Sign in again.');
        }

        return user;
    }
}
