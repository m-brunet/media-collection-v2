import type { LendableBook } from '../../../domain/entities/loan.entity.js';

// The books lending reads: identity, ownership and whether each one has an active loan.
export interface LendableBooks {
    // Books that do not exist are left out.
    find(ids: readonly string[]): Promise<LendableBook[]>;
}
