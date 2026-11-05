import type {
    CollectionDetailsView,
    CollectionSummaryView,
    MemberBookView,
} from '../collection-views.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type { MemberRecord } from '../ports/driven/collection-member-store.interface.js';
import type { Collection } from '../../domain/entities/collection.entity.js';

// Describes a collection from its saved members: whole-collection counts, and the expected
// volumes in coverage order with the books covering each.
export class CollectionViewer {
    summary(collection: Collection, records: readonly MemberRecord[]): CollectionSummaryView {
        const { id, name, includesVolumeZero, finished } = collection.snapshot;
        const coverage = collection.coverage(MemberCoverage.of(records));

        return {
            id,
            name,
            includesVolumeZero,
            finished,
            bookCount: records.length,
            expectedFrom: coverage.start,
            expectedTo: coverage.highest ?? coverage.start,
            expectedCount: coverage.expected,
            ownedCount: coverage.ownedVolumes,
            missingCount: coverage.missing.length,
            lastOwned: coverage.lastOwned,
        };
    }

    details(collection: Collection, records: readonly MemberRecord[]): CollectionDetailsView {
        const books = new Map(records.map((record) => [record.bookId, this.book(record)]));
        const coverage = collection.coverage(MemberCoverage.of(records));

        return {
            ...this.summary(collection, records),
            volumes: coverage.volumes().map((entry) => ({
                from: entry.from,
                to: entry.to,
                state: entry.state,
                books: entry.bookIds.map((bookId) => books.get(bookId)!),
            })),
        };
    }

    private book(record: MemberRecord): MemberBookView {
        return {
            id: record.bookId,
            title: record.title,
            isbn: record.isbn,
            category: record.category,
            ownership: record.ownership,
            hasCover: record.hasCover,
            volumeFrom: record.volumeFrom,
            volumeTo: record.volumeTo,
        };
    }
}
