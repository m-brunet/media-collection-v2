import type {
    ActivityEntry,
    ActivityOperation,
    ActivityRecord,
} from './activity-projection.service.js';
import { ActivityProjection } from './activity-projection.service.js';

// Turns operations, newest first, into Activity entries in the same order. The book form saves
// the cover as its own operation right after the book, so a cover change joins the creation or
// update of the same book by the same account made at most two minutes before it, instead of
// being a second entry.
export class ActivityTimeline {
    static readonly coverWindowMs = 2 * 60 * 1000;
    private static readonly saveCategories: readonly string[] = [
        'book.created',
        'book.updated',
        'book.marked-owned',
    ];

    static of(operations: readonly ActivityOperation[]): ActivityEntry[] {
        return operations.flatMap((operation, index) => {
            if (ActivityTimeline.folded(operation, operations.slice(index + 1))) {
                return [];
            }

            const entry = ActivityProjection.entry(operation);

            return entry ? [entry] : [];
        });
    }

    // Whether this operation is a lone cover change that an older save of the same book joins.
    private static folded(
        operation: ActivityOperation,
        older: readonly ActivityOperation[],
    ): boolean {
        const [cover] = operation.records;

        if (operation.records.length !== 1 || cover!.category !== 'book.cover-changed') {
            return false;
        }

        return older.some(
            (save) =>
                save.actorId !== null &&
                save.actorId === operation.actorId &&
                ActivityTimeline.within(save.occurredAt, operation.occurredAt) &&
                save.records.some((record) => ActivityTimeline.savesBook(record, cover!)),
        );
    }

    private static within(saved: string, covered: string): boolean {
        const elapsed = Date.parse(covered) - Date.parse(saved);

        return elapsed >= 0 && elapsed <= ActivityTimeline.coverWindowMs;
    }

    private static savesBook(record: ActivityRecord, cover: ActivityRecord): boolean {
        return (
            record.subjectId === cover.subjectId &&
            ActivityTimeline.saveCategories.includes(record.category)
        );
    }
}
