import type { User } from '../../../domain/entities/user.entity.js';

export interface UserWriter {
    create(user: User): Promise<void>;
    save(user: User, expectedVersion: number): Promise<void>;
}
