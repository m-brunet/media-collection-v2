import type {
    BookCategory,
    BookFilterParams,
    BookOwnership,
} from '../../../../../packages/contracts/src/http';

export type FilterKey = keyof BookFilterParams;

// Every advanced filter, each a list of chosen values (empty: not filtered).
export type Filter = { [K in FilterKey]-?: NonNullable<BookFilterParams[K]> };

// One chosen value, as shown in the applied-filter chips.
export interface FilterEntry {
    key: FilterKey;
    value: string;
}

export type TagChoice = 'none' | 'include' | 'exclude';

const categories: readonly BookCategory[] = ['books', 'manga', 'comics'];
const ownerships: readonly BookOwnership[] = ['owned', 'not-owned'];
const readings = ['read', 'unread'] as const;

// Advanced book filters kept in the page address, with the same parameters as the API
// (`?category=manga&category=comics&tag=<id>&notTag=<id>`), so a filtered list can be reloaded,
// bookmarked and shared.
export class BookFilter {
    static readonly keys: readonly FilterKey[] = [
        'category',
        'author',
        'collection',
        'location',
        'ownership',
        'reading',
        'tag',
        'notTag',
    ];

    static empty(): Filter {
        return {
            category: [],
            author: [],
            collection: [],
            location: [],
            ownership: [],
            reading: [],
            tag: [],
            notTag: [],
        };
    }

    // Unknown enumeration values are ignored; ids are left to the server, which matches nothing
    // for an unknown one.
    static read(parameters: URLSearchParams): Filter {
        const all = (key: FilterKey) => [...new Set(parameters.getAll(key).filter(Boolean))];

        return {
            category: all('category').filter((value): value is BookCategory =>
                categories.includes(value as BookCategory),
            ),
            author: all('author'),
            collection: all('collection'),
            location: all('location'),
            ownership: all('ownership').filter((value): value is BookOwnership =>
                ownerships.includes(value as BookOwnership),
            ),
            reading: all('reading').filter((value): value is (typeof readings)[number] =>
                readings.includes(value as (typeof readings)[number]),
            ),
            tag: all('tag'),
            notTag: all('notTag'),
        };
    }

    // The other parameters (search, sort) are kept; the filter ones are replaced.
    static write(filter: Filter, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
        const next = new URLSearchParams(base);

        for (const key of BookFilter.keys) {
            next.delete(key);

            for (const value of filter[key]) {
                next.append(key, value);
            }
        }

        return next;
    }

    static entries(filter: Filter): FilterEntry[] {
        return BookFilter.keys.flatMap((key) =>
            (filter[key] as string[]).map((value) => ({ key, value })),
        );
    }

    static active(filter: Filter): boolean {
        return BookFilter.entries(filter).length > 0;
    }

    static has(filter: Filter, key: FilterKey, value: string): boolean {
        return (filter[key] as string[]).includes(value);
    }

    static toggle(filter: Filter, key: FilterKey, value: string): Filter {
        return BookFilter.has(filter, key, value)
            ? BookFilter.remove(filter, key, value)
            : { ...filter, [key]: [...filter[key], value] };
    }

    static remove(filter: Filter, key: FilterKey, value: string): Filter {
        return { ...filter, [key]: (filter[key] as string[]).filter((item) => item !== value) };
    }

    static tagChoice(filter: Filter, tagId: string): TagChoice {
        if (filter.tag.includes(tagId)) {
            return 'include';
        }

        return filter.notTag.includes(tagId) ? 'exclude' : 'none';
    }

    // A tag is included, excluded or neither, never both.
    static withTag(filter: Filter, tagId: string, choice: TagChoice): Filter {
        return {
            ...filter,
            tag: [
                ...filter.tag.filter((id) => id !== tagId),
                ...(choice === 'include' ? [tagId] : []),
            ],
            notTag: [
                ...filter.notTag.filter((id) => id !== tagId),
                ...(choice === 'exclude' ? [tagId] : []),
            ],
        };
    }

    static withoutTags(filter: Filter): Filter {
        return { ...filter, tag: [], notTag: [] };
    }

    // Guests have no reading status to filter on; collection listings have no collection field.
    static applicable(filter: Filter, options: { guest: boolean; collections: boolean }): Filter {
        return {
            ...filter,
            ...(options.guest ? { reading: [] } : {}),
            ...(options.collections ? { collection: [] } : {}),
        };
    }
}
