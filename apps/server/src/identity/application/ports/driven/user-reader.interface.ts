import type { User } from '../../../domain/entities/user.entity.js';

export interface UserReader {
    findById(id: string): Promise<User | null>;
    // Exact spelling, including letter case (sign-in is case-sensitive).
    findByUsername(username: string): Promise<User | null>;
    list(): Promise<User[]>;
}
