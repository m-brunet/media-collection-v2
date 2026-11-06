import { describe, expect, it } from 'vitest';
import type { V1ImportReport } from '../../../../application/ports/driving/import-v1-library-use-case.interface.js';
import { DevelopmentDataReport } from './development-data-report.adapter.js';

function imported(overrides: Partial<V1ImportReport> = {}): V1ImportReport {
    return {
        erased: { books: 1, authors: 1, collections: 0, loans: 0 },
        books: 2,
        collections: 1,
        finished: [],
        unfinished: [],
        titled: [],
        coversStored: 2,
        coversSkipped: [],
        ...overrides,
    };
}

describe('DevelopmentDataReport', () => {
    it('reports a reset with what it deleted and kept', () => {
        const report = { books: 3, authors: 2, collections: 1, loans: 0, removedCoverFiles: 3 };

        const result = DevelopmentDataReport.reset('/repo/.dev-data', report);

        expect(result).toEqual([
            'Development library emptied in /repo/.dev-data.',
            'Deleted 3 books, 2 authors, 1 collections, 0 loans and 3 cover files.',
            'Accounts and server settings were kept; every session was signed out.',
        ]);
    });
    it('reports an import with none marked Finished', () => {
        const report = imported();

        const result = DevelopmentDataReport.importV1('/repo/.dev-data', report);

        expect(result).toEqual([
            'Development library in /repo/.dev-data replaced by the V1 dump.',
            'Removed the previous 1 books, 0 collections and 0 loans; accounts and server settings were kept.',
            'Imported 2 books in 1 collections, with 2 covers.',
            'Marked Finished: none.',
        ]);
    });
    it('lists unfinished collections, retitled Books and missing covers', () => {
        const report = imported({
            unfinished: [{ name: 'Doubt', lastVolume: 4, missing: [2], beyond: [5] }],
            titled: [{ record: 7, title: 'Gunnm Vol. 2' }],
            coversSkipped: [
                { record: 3, title: 'Alita', reason: 'unusable' },
                { record: 4, title: 'Rusty', reason: 'unavailable' },
            ],
        });

        const result = DevelopmentDataReport.importV1('/repo/.dev-data', report);

        expect(result.slice(4)).toEqual([
            'Left unfinished: Doubt (last volume 4; missing 2; beyond it 5).',
            'Untitled Book, record 7: saved with the title "Gunnm Vol. 2".',
            'No cover for record 3 (Alita): not a JPEG, PNG or WebP image.',
            'No cover for record 4 (Rusty): could not be downloaded.',
        ]);
    });
});
