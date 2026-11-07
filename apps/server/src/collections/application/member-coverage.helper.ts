import type { MemberRecord } from './ports/driven/collection-member-store.interface.js';
import type { ShoppingMember } from '../domain/services/collection-shopping.service.js';
import type { CoverageMember } from '../domain/value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../domain/value-objects/volume-range.value-object.js';

// Saved memberships as the coverage rules see them.
export class MemberCoverage {
    static of(records: readonly MemberRecord[]): CoverageMember[] {
        return records.map((record) => ({
            bookId: record.bookId,
            ownership: record.ownership,
            range: VolumeRange.of(record.volumeFrom, record.volumeTo),
        }));
    }

    // With the title and category the shopping view shows.
    static forShopping(records: readonly MemberRecord[]): ShoppingMember[] {
        return records.map((record) => ({
            bookId: record.bookId,
            ownership: record.ownership,
            range: VolumeRange.of(record.volumeFrom, record.volumeTo),
            title: record.title,
            category: record.category,
        }));
    }
}
