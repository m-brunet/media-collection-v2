import type { LendableBook } from '../../../domain/entities/loan.entity.js';

export interface LendableBooks {
    // Books that do not exist are left out.
    find(ids: readonly string[]): Promise<LendableBook[]>;
}
