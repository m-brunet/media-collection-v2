import type {
    CollectionCoverage,
    CoverageMember,
} from '../value-objects/collection-coverage.value-object.js';

// A member as the shopping view needs it: its coverage, title and category.
export interface ShoppingMember extends CoverageMember {
    title: string;
    category: 'books' | 'manga' | 'comics';
}

export interface LastOwnedVolume {
    volume: number;
    // Only for the Books category; Manga and Comics are known by their number.
    title: string | null;
}

export interface MissingVolume {
    volume: number;
    // A saved Not Owned book covers it; otherwise the volume is only inferred.
    saved: boolean;
    // The saved ordinary Not Owned book that may be marked Owned from the shopping view.
    quickAdd: { bookId: string; title: string } | null;
}

export interface ShoppingList {
    lastOwned: LastOwnedVolume | null;
    missing: MissingVolume[];
}

// What to look for while shopping: the last Owned volume and every missing volume. Quick add is
// offered only for a volume covered by exactly one saved single-volume Not Owned book; inferred
// volumes, omnibus editions and ambiguous coverage need the full book entry.
export class CollectionShopping {
    static of(coverage: CollectionCoverage, members: readonly ShoppingMember[]): ShoppingList {
        return {
            lastOwned: CollectionShopping.lastOwned(coverage, members),
            missing: coverage.missing.map((volume) => CollectionShopping.missing(volume, members)),
        };
    }

    private static lastOwned(
        coverage: CollectionCoverage,
        members: readonly ShoppingMember[],
    ): LastOwnedVolume | null {
        const volume = coverage.lastOwned;

        if (volume === null) {
            return null;
        }

        const book = members.find(
            (member) => member.ownership === 'owned' && member.range.covers(volume),
        )!;

        return { volume, title: book.category === 'books' ? book.title : null };
    }

    private static missing(volume: number, members: readonly ShoppingMember[]): MissingVolume {
        const covering = members.filter((member) => member.range.covers(volume));
        const only = covering.length === 1 ? covering[0] : undefined;

        return {
            volume,
            saved: covering.length > 0,
            quickAdd:
                only && only.ownership === 'not-owned' && !only.range.omnibus
                    ? { bookId: only.bookId, title: only.title }
                    : null,
        };
    }
}
