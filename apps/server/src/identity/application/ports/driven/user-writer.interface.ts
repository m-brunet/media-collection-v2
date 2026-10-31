import type { User } from '../../../domain/entities/user.entity.js';

export interface UserWriter {
    create(user: User): Promise<void>;
    // Reject stale writes with a conflict; never overwrite a newer password reset.
    save(user: User, expectedVersion: number): Promise<void>;
}
