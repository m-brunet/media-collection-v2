import type {
    CollectionStatus as CollectionState,
    CollectionSummaryDto,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';

export interface Message {
    key: MessageKey;
    values?: MessageValues;
}

export type CollectionStatus = 'all' | 'unfinished' | 'finished';

export class CollectionFormat {
    static readonly statuses = [
        { status: 'all', label: 'collections.statusAll' },
        { status: 'unfinished', label: 'collections.statusUnfinished' },
        { status: 'finished', label: 'collections.statusFinished' },
    ] as const satisfies readonly { status: CollectionStatus; label: MessageKey }[];

    static listStatus(value: string | null): CollectionStatus {
        return value === 'true' ? 'finished' : value === 'false' ? 'unfinished' : 'all';
    }

    static listStatusParameter(status: CollectionStatus): string {
        return status === 'all' ? '' : String(status === 'finished');
    }

    static readonly sorts = [
        { direction: 'asc', label: 'collections.sort.nameAsc' },
        { direction: 'desc', label: 'collections.sort.nameDesc' },
    ] as const satisfies readonly { direction: 'asc' | 'desc'; label: MessageKey }[];

    static volumes(from: number, to: number): Message {
        return from === to
            ? { key: 'volume.one', values: { number: from } }
            : { key: 'volume.range', values: { from, to } };
    }

    static expected(collection: CollectionSummaryDto): Message {
        const { expectedFrom: from, expectedTo: to } = collection;

        return from === to
            ? { key: 'collection.expectedOne', values: { number: from } }
            : { key: 'collection.expectedRange', values: { from, to } };
    }

    static status(collection: CollectionSummaryDto): Message {
        if (collection.status === 'finished') {
            return { key: 'collections.finished' };
        }

        if (collection.status === 'dropped') {
            return { key: 'collections.dropped' };
        }

        return collection.missingCount > 0
            ? { key: 'collection.statusMissing', values: { count: collection.missingCount } }
            : { key: 'collection.statusNoGaps' };
    }

    static coverage(collection: CollectionSummaryDto): Message {
        if (collection.status === 'finished') {
            return { key: 'collection.coverageComplete' };
        }

        return collection.missingCount > 0
            ? { key: 'collection.coverageMissing', values: { count: collection.missingCount } }
            : { key: 'collection.coverageNoGaps' };
    }

    static label(status: CollectionState): Message {
        return { key: CollectionFormat.labels[status] };
    }

    private static readonly labels: Record<CollectionState, MessageKey> = {
        unfinished: 'collection.labelUnfinished',
        finished: 'collection.labelFinished',
        dropped: 'collection.labelDropped',
    };
}
