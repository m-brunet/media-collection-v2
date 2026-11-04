import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { User } from '../../domain/entities/user.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class CurrentPasswordConfirmation {
    constructor(private readonly passwords: PasswordHasher) {}

    async confirm(user: User, password: string): Promise<void> {
        if (!(await this.passwords.matches(password, user.snapshot.passwordHash))) {
            throw new Failure(
                'invalid_input',
                'The current password is incorrect.',
                'password-incorrect',
            );
        }
    }
}
