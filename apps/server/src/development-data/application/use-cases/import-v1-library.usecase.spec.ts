import { describe, expect, it } from 'vitest';
import type { V1Book } from '../../domain/services/v1-library-planner.service.js';
import type { CoverDownloads } from '../ports/driven/cover-downloads.interface.js';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { LibraryAdministrator } from '../ports/driven/library-administrator.interface.js';
import type { LibraryEraser } from '../ports/driven/library-eraser.interface.js';
import type { V1Dump } from '../ports/driven/v1-dump.interface.js';
import type {
    ImportBookUseCase,
    ImportedBook,
} from '../../../books/application/ports/driving/import-book-use-case.interface.js';
import type { FinishCollectionUseCase } from '../../../collections/application/ports/driving/finish-collection-use-case.interface.js';
import type { TransactionRunner } from '../../../shared/application/ports/driven/transaction-runner.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ImportV1Library } from './import-v1-library.usecase.js';

const admin: Actor = {
    id: 'admin-id',
    username: 'admin',
    role: 'admin',
    mustChangePassword: false,
    language: null,
};
const image = new Uint8Array([0xff, 0xd8, 0xff, 1]);

function v1(record: number, overrides: Partial<V1Book> = {}): V1Book {
    return {
        record,
        title: '',
        isbn: '978000000000' + record,
        authors: ['Yukito Kishiro'],
        type: 'manga',
        bought: true,
        read: 'READ',
        volume: record,
        collectionName: 'Gunnm',
        lastElement: false,
        pageCount: 200,
        price: 6.5,
        publisher: 'Glénat',
        cover: 'http://example.test/' + record + '.jpg',
        created: '2017-01-15T16:53:12.369Z',
        ...overrides,
    };
}

function doubles(books: V1Book[], options: { administrator?: Actor | null; failAt?: number } = {}) {
    const events: string[] = [];
    const saved: ImportedBook[] = [];
    const finished: string[] = [];
    const dump: V1Dump = {
        read: async () => ({ books, corrections: { isbns: [], categories: [] } }),
    };
    const downloads: CoverDownloads = {
        fetchAll: async (urls) => {
            events.push(...urls.map((url) => 'download ' + url));

            return new Map(
                urls.filter((url) => !url.endsWith('/2.jpg')).map((url) => [url, image]),
            );
        },
    };
    const administrator: LibraryAdministrator = {
        find: async () => (options.administrator === undefined ? admin : options.administrator),
    };
    const eraser: LibraryEraser = {
        erase: async () => {
            events.push('erase');

            return { books: 7, authors: 2, collections: 1, loans: 0 };
        },
    };
    const covers: CoverFileCleanup = {
        removeUnreferenced: async () => {
            events.push('cleanup');

            return 0;
        },
    };
    const transactions: TransactionRunner = {
        run: async (work) => {
            events.push('begin');

            try {
                const result = await work();

                events.push('commit');

                return result;
            } catch (error) {
                events.push('rollback');

                throw error;
            }
        },
    };
    const importBook: ImportBookUseCase = {
        execute: async (actor, book) => {
            if (saved.length + 1 === options.failAt) {
                throw new Error('disk full');
            }

            saved.push(book);
            events.push('save ' + actor.username);

            return {
                bookId: 'book-' + saved.length,
                title: book.title || book.collection!.name + ' Vol. ' + book.collection!.volume,
                collectionId: book.collection ? 'collection-' + book.collection.name : null,
                cover: book.cover ? 'stored' : 'none',
            };
        },
    };
    const finish: FinishCollectionUseCase = {
        execute: async (_actor, collectionId) => {
            finished.push(collectionId);

            return {} as Awaited<ReturnType<FinishCollectionUseCase['execute']>>;
        },
    };

    return {
        events,
        saved,
        finished,
        subject: new ImportV1Library(
            dump,
            downloads,
            administrator,
            eraser,
            covers,
            transactions,
            importBook,
            finish,
        ),
    };
}

describe('ImportV1Library', () => {
    it('replaces the library with the planned books, as the administrator', async () => {
        const current = doubles([v1(1), v1(2)]);

        const result = await current.subject.execute();

        expect(current.saved).toMatchObject([
            {
                title: '',
                isbn: '9780000000001',
                category: 'manga',
                collection: { name: 'Gunnm', volume: 1 },
                createdAt: '2017-01-15T16:53:12.369Z',
                read: true,
                price: '6.5',
            },
            { collection: { name: 'Gunnm', volume: 2 } },
        ]);
        expect(result).toMatchObject({
            erased: { books: 7 },
            books: 2,
            collections: 1,
            coversStored: 1,
            coversSkipped: [{ record: 2, title: 'Gunnm Vol. 2', reason: 'unavailable' }],
        });
    });
    it('fetches every cover before erasing anything, and tidies covers last', async () => {
        const current = doubles([v1(1)]);

        await current.subject.execute();

        expect(current.events).toEqual([
            'download http://example.test/1.jpg',
            'begin',
            'erase',
            'save admin',
            'commit',
            'cleanup',
        ]);
    });
    it('marks Finished the collections owned up to their last volume', async () => {
        const current = doubles([v1(1), v1(2, { lastElement: true })]);

        const result = await current.subject.execute();

        expect(current.finished).toEqual(['collection-Gunnm']);
        expect(result.finished).toEqual(['Gunnm']);
    });
    it('reports the untitled Books, with the title the books import saved', async () => {
        const current = doubles([v1(1), v1(2, { type: 'book' })]);

        const result = await current.subject.execute();

        expect(result.titled).toEqual([{ record: 2, title: 'Gunnm Vol. 2' }]);
    });
    it('rolls everything back when one book cannot be saved, then tidies the covers', async () => {
        const current = doubles([v1(1), v1(2)], { failAt: 2 });

        const result = current.subject.execute();

        await expect(result).rejects.toThrow('disk full');
        expect(current.events.slice(-2)).toEqual(['rollback', 'cleanup']);
    });
    it('writes nothing when the dump needs corrections', async () => {
        const current = doubles([v1(1, { isbn: null })]);

        const result = current.subject.execute();

        await expect(result).rejects.toMatchObject({ reason: 'v1-dump-invalid' });
        expect(current.events).toEqual([]);
    });
    it('requires the administrator of a completed setup', async () => {
        const current = doubles([v1(1)], { administrator: null });

        const result = current.subject.execute();

        await expect(result).rejects.toMatchObject({ reason: 'setup-required' });
        expect(current.events).toEqual([]);
    });
});
