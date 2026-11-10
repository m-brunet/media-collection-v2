import type {
    ResetDevelopmentDataUseCase,
    ResetReport,
} from '../ports/driving/reset-development-data-use-case.interface.js';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { LibraryEraser } from '../ports/driven/library-eraser.interface.js';
import type { TransactionRunner } from '../../../shared/application/ports/driven/transaction-runner.interface.js';

// Development tooling run by the developer on their own data directory, so no account acts.
export class ResetDevelopmentData implements ResetDevelopmentDataUseCase {
    constructor(
        private readonly eraser: LibraryEraser,
        private readonly covers: CoverFileCleanup,
        private readonly transactions: TransactionRunner,
    ) {}

    async execute(): Promise<ResetReport> {
        const erased = await this.transactions.run(() => this.eraser.erase());
        const removedCoverFiles = await this.covers.removeUnreferenced();

        return { ...erased, removedCoverFiles };
    }
}
