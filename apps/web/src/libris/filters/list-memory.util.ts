import { BookFormat } from '../../shared/book-form/book-format.util';
import { BookFilter } from './book-filter.util';

export type ListName = 'books' | 'collections';

export class ListMemory {
    private static readonly version = 1;

    static recognizes(list: ListName, parameters: URLSearchParams): boolean {
        return ['search', ...ListMemory.keys(list)].some((key) => parameters.has(key));
    }

    static choices(list: ListName, parameters: URLSearchParams, guest: boolean): URLSearchParams {
        const filter = BookFilter.applicable(BookFilter.read(parameters), {
            guest,
            collections: list === 'collections',
        });
        const choices = BookFilter.write(filter);

        if (list === 'books') {
            const sort = parameters.get('sort');

            if (BookFormat.sorts.some((choice) => choice.sort + '-' + choice.direction === sort)) {
                choices.set('sort', sort ?? '');
            }
        } else {
            if (parameters.get('direction') === 'desc') {
                choices.set('direction', 'desc');
            }

            const finished = parameters.get('finished');

            if (finished === 'true' || finished === 'false') {
                choices.set('finished', finished);
            }
        }

        return choices;
    }

    static read(accountId: string, list: ListName, guest: boolean): URLSearchParams | null {
        try {
            const stored: unknown = JSON.parse(
                window.localStorage.getItem(ListMemory.key(accountId, list)) ?? 'null',
            );

            if (
                typeof stored !== 'object' ||
                stored === null ||
                !('version' in stored) ||
                stored.version !== ListMemory.version ||
                !('choices' in stored) ||
                typeof stored.choices !== 'string'
            ) {
                return null;
            }

            return ListMemory.choices(list, new URLSearchParams(stored.choices), guest);
        } catch {
            // Justified: a browser may refuse storage or hold a broken record; the list then opens on its defaults.
            return null;
        }
    }

    static write(accountId: string, list: ListName, choices: URLSearchParams): void {
        try {
            window.localStorage.setItem(
                ListMemory.key(accountId, list),
                JSON.stringify({ version: ListMemory.version, choices: choices.toString() }),
            );
        } catch {
            // Justified: a browser may refuse storage; browsing goes on without remembering.
        }
    }

    private static keys(list: ListName): string[] {
        return list === 'books'
            ? [...BookFilter.keys.filter((key) => key !== 'dropped'), 'sort']
            : [...BookFilter.keys.filter((key) => key !== 'collection'), 'direction', 'finished'];
    }

    private static key(accountId: string, list: ListName): string {
        return 'media-collection.list-choices.' + list + '.' + accountId;
    }
}
