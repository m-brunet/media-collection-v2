import type { LendableBook } from '../../../domain/entities/loan.entity.js';

export interface LendableBooks {
    find(ids: readonly string[]): Promise<LendableBook[]>;
}
