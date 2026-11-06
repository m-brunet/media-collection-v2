import type {
    ImportV1LibraryUseCase,
    V1ImportReport,
} from '../ports/driving/import-v1-library-use-case.interface.js';
import type { CoverDownloads } from '../ports/driven/cover-downloads.interface.js';
import type { CoverFileCleanup } from '../ports/driven/cover-file-cleanup.interface.js';
import type { LibraryAdministrator } from '../ports/driven/library-administrator.interface.js';
import type { LibraryEraser } from '../ports/driven/library-eraser.interface.js';
import type { V1Dump } from '../ports/driven/v1-dump.interface.js';
import type { PlannedBook } from '../../domain/services/v1-library-planner.service.js';
import { V1LibraryPlanner } from '../../domain/services/v1-library-planner.service.js';
import type { ImportBookUseCase } from '../../../books/application/ports/driving/import-book-use-case.interface.js';
import type { FinishCollectionUseCase } from '../../../collections/application/ports/driving/finish-collection-use-case.interface.js';
import type { TransactionRunner } from '../../../shared/application/ports/driven/transaction-runner.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

// Replaces the development library with the V1 backup. The whole dump is checked and its covers
// fetched before anything is written; then the library is erased and the books saved, as the
// administrator, in one transaction, so a failure keeps the previous library.
export class ImportV1Library implements ImportV1LibraryUseCase {
    private static readonly parallelDownloads = 8;

    constructor(
        private readonly dump: V1Dump,
        private readonly downloads: CoverDownloads,
        private readonly administrator: LibraryAdministrator,
        private readonly eraser: LibraryEraser,
        private readonly covers: CoverFileCleanup,
        private readonly transactions: TransactionRunner,
        private readonly books: ImportBookUseCase,
        private readonly collections: FinishCollectionUseCase,
    ) {}

    async execute(): Promise<V1ImportReport> {
        const actor = await this.administrator.find();

        if (!actor) {
            throw new Failure(
                'conflict',
                'Complete the setup of the development application first: the import needs its administrator.',
                'setup-required',
            );
        }

        const { books, corrections } = await this.dump.read();
        const plan = V1LibraryPlanner.plan(books, corrections);
        const images = await this.download(plan.books);

        try {
            return await this.transactions.run(async () => {
                const erased = await this.eraser.erase();
                const collectionIds = new Map<string, string>();
                const report: V1ImportReport = {
                    erased,
                    books: 0,
                    collections: 0,
                    finished: plan.finished,
                    unfinished: plan.unfinished,
                    titled: plan.titled,
                    coversStored: 0,
                    coversSkipped: [],
                };

                for (const book of plan.books) {
                    const outcome = await this.books.execute(actor, {
                        title: book.title,
                        isbn: book.isbn,
                        authors: book.authors,
                        category: book.category,
                        ownership: book.ownership,
                        publisher: book.publisher,
                        pageCount: book.pageCount,
                        price: book.price,
                        collection: book.collection,
                        createdAt: book.createdAt,
                        read: book.read,
                        cover: images.get(book.record) ?? null,
                    });

                    report.books++;

                    if (book.collection && outcome.collectionId) {
                        collectionIds.set(NameKey.of(book.collection.name), outcome.collectionId);
                    }

                    if (outcome.cover === 'stored') {
                        report.coversStored++;
                    } else if (book.coverUrl) {
                        report.coversSkipped.push({
                            record: book.record,
                            title:
                                book.title ||
                                book.collection!.name + ' - ' + book.collection!.volume,
                            reason: outcome.cover === 'rejected' ? 'unusable' : 'unavailable',
                        });
                    }
                }

                for (const name of plan.finished) {
                    await this.collections.execute(actor, collectionIds.get(NameKey.of(name))!);
                }

                report.collections = new Set(collectionIds.values()).size;

                return report;
            });
        } finally {
            // After a failure, the covers stored for the rolled-back books; after a success, the
            // previous library's covers.
            await this.covers.removeUnreferenced();
        }
    }

    private async download(books: readonly PlannedBook[]): Promise<Map<number, Uint8Array>> {
        const images = new Map<number, Uint8Array>();
        const queue = books.filter((book) => book.coverUrl !== null);
        const worker = async () => {
            for (let book = queue.shift(); book; book = queue.shift()) {
                const bytes = await this.downloads.fetch(book.coverUrl!);

                if (bytes) {
                    images.set(book.record, bytes);
                }
            }
        };

        await Promise.all(Array.from({ length: ImportV1Library.parallelDownloads }, worker));

        return images;
    }
}
