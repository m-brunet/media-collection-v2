import type { MemberRecord } from './ports/driven/collection-member-store.interface.js';
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
}
