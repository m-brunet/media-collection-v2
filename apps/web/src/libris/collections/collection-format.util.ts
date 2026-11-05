import type {
    CollectionSummaryDto,
    CollectionVolumeDto,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';

// A translatable text: its key and the values it needs.
export interface Message {
    key: MessageKey;
    values?: MessageValues;
}

// Interface wording of collection coverage. Completeness counts distinct volumes, not editions.
export class CollectionFormat {
    static readonly sorts = [
        { direction: 'asc', label: 'collections.sort.nameAsc' },
        { direction: 'desc', label: 'collections.sort.nameDesc' },
    ] as const satisfies readonly { direction: 'asc' | 'desc'; label: MessageKey }[];

    // "Volume 3" or "Volumes 1–3".
    static volumes(from: number, to: number): Message {
        return from === to
            ? { key: 'volume.one', values: { number: from } }
            : { key: 'volume.range', values: { from, to } };
    }

    // Short state of a collection in the list.
    static status(collection: CollectionSummaryDto): Message {
        if (collection.finished) {
            return { key: 'collections.finished' };
        }

        return collection.missingCount > 0
            ? { key: 'collection.statusMissing', values: { count: collection.missingCount } }
            : { key: 'collection.statusNoGaps' };
    }

    // State of a collection on its own page.
    static badge(collection: CollectionSummaryDto): Message {
        return collection.finished
            ? { key: 'collection.statusFinished' }
            : CollectionFormat.status(collection);
    }

    // What covers an expected volume entry.
    static state(volume: CollectionVolumeDto): Message {
        if (volume.state === 'inferred') {
            return { key: 'collection.state.inferred' };
        }

        if (volume.state === 'planned') {
            return { key: 'collection.state.planned' };
        }

        const owned = volume.books.filter((book) => book.ownership === 'owned');
        const only = owned.length === 1 ? owned[0]! : null;

        if (only && only.volumeTo > only.volumeFrom) {
            return {
                key: 'collection.state.ownedBy',
                values: { from: only.volumeFrom, to: only.volumeTo },
            };
        }

        return volume.books.length === 1
            ? { key: 'collection.state.ownedOne' }
            : { key: 'collection.state.ownedMany', values: { count: volume.books.length } };
    }
}
