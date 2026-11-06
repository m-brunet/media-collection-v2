import { describe, expect, it } from 'vitest';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { ErasedLibrary, LibraryEraser } from '../ports/driven/library-eraser.interface.js';
import type { TransactionRunner } from '../../../shared/application/ports/driven/transaction-runner.interface.js';
import { ResetDevelopmentData } from './reset-development-data.usecase.js';

const erased: ErasedLibrary = { books: 3, authors: 2, collections: 1, loans: 1 };

function doubles(failure?: Error) {
    const events: string[] = [];
    const eraser: LibraryEraser = {
        erase: () => {
            events.push('erase');

            return failure ? Promise.reject(failure) : Promise.resolve(erased);
        },
    };
    const covers: CoverFileCleanup = {
        removeUnreferenced: () => {
            events.push('covers');

            return Promise.resolve(4);
        },
    };
    const transactions: TransactionRunner = {
        run: async (work) => {
            events.push('begin');
            const result = await work();

            events.push('commit');

            return result;
        },
    };

    return { events, subject: new ResetDevelopmentData(eraser, covers, transactions) };
}

describe('ResetDevelopmentData', () => {
    it('erases the library in a transaction, then removes the unreferenced covers', async () => {
        const { events, subject } = doubles();

        const result = await subject.execute();

        expect(result).toEqual({ ...erased, removedCoverFiles: 4 });
        expect(events).toEqual(['begin', 'erase', 'commit', 'covers']);
    });
    it('keeps the cover files when the library could not be erased', async () => {
        const { events, subject } = doubles(new Error('locked'));

        const result = subject.execute();

        await expect(result).rejects.toThrow('locked');
        expect(events).toEqual(['begin', 'erase']);
    });
});
