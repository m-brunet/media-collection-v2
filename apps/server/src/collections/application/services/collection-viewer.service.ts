import type {
    CollectionDetailsView,
    CollectionPreviewView,
    CollectionShoppingView,
    CollectionSummaryView,
    MemberBookView,
    ShoppingCollectionView,
} from '../collection-views.js';
import { MemberCoverage } from '../member-coverage.helper.js';
import type { MemberRecord } from '../ports/driven/collection-member-store.interface.js';
import type { Collection } from '../../domain/entities/collection.entity.js';
import { CollectionShopping } from '../../domain/services/collection-shopping.service.js';
import { Required } from '../../../shared/domain/required.helper.js';

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
            previews: this.previews(records),
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
                books: entry.bookIds.map((bookId) =>
                    Required.value(books.get(bookId), 'coverage only lists member books'),
                ),
            })),
        };
    }

    shoppingSummary(
        collection: Collection,
        records: readonly MemberRecord[],
    ): ShoppingCollectionView {
        const { id, name, expectedCount, ownedCount, missingCount, lastOwned } = this.summary(
            collection,
            records,
        );

        return { id, name, expectedCount, ownedCount, missingCount, lastOwned };
    }

    shopping(collection: Collection, records: readonly MemberRecord[]): CollectionShoppingView {
        const { id, name, finished } = collection.snapshot;
        const coverage = collection.coverage(MemberCoverage.of(records));

        return {
            id,
            name,
            finished,
            expectedCount: coverage.expected,
            ownedCount: coverage.ownedVolumes,
            ...CollectionShopping.of(coverage, MemberCoverage.forShopping(records)),
        };
    }

    private previews(records: readonly MemberRecord[]): CollectionPreviewView[] {
        const covered = records.filter((record) => record.hasCover);

        return [
            ...covered.filter((record) => record.ownership === 'owned'),
            ...covered.filter((record) => record.ownership !== 'owned'),
        ]
            .slice(0, 2)
            .map(({ bookId, title, updatedAt }) => ({ id: bookId, title, updatedAt }));
    }

    private book(record: MemberRecord): MemberBookView {
        return {
            id: record.bookId,
            title: record.title,
            isbn: record.isbn,
            publisher: record.publisher,
            category: record.category,
            ownership: record.ownership,
            hasCover: record.hasCover,
            updatedAt: record.updatedAt,
            volumeFrom: record.volumeFrom,
            volumeTo: record.volumeTo,
        };
    }
}
