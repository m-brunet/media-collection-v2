import type {
    BookLocationDto,
    ShelfPlacementDto,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { LocationFormat } from './location-format.util';

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export class ShelfPlacement {
    static path(shelfId: string): string {
        return '/bookshelves/shelves/' + shelfId + '/add-books';
    }

    static opening(shelfId: string): string {
        return ShelfPlacement.path(shelfId) + '?location=none';
    }

    static summary(
        books: readonly { from: BookLocationDto | null }[],
        shelf: string,
        t: Translate,
        locale: string,
    ): string {
        const origins = books.flatMap(({ from }) => (from ? [LocationFormat.label(from)] : []));
        const placed = books.length - origins.length;
        const places = new Intl.ListFormat(locale, { type: 'conjunction' }).format([
            ...new Set(origins),
        ]);

        return [
            ...(placed > 0
                ? [
                      t(placed === 1 ? 'addBooks.placedOne' : 'addBooks.placed', {
                          count: placed,
                          shelf,
                      }),
                  ]
                : []),
            origins.length > 0
                ? t(origins.length === 1 ? 'addBooks.movedOne' : 'addBooks.moved', {
                      count: origins.length,
                      places,
                  })
                : t('addBooks.noneMoved'),
        ].join(' · ');
    }

    static done(result: ShelfPlacementDto, t: Translate, locale: string): string {
        const changed = [
            ...result.placed.map(() => ({ from: null })),
            ...result.moved.map(({ from }) => ({ from })),
        ];
        const shelf = result.shelf.shelfName;

        if (changed.length === 0) {
            return t('addBooks.nothingChanged', { shelf });
        }

        return [
            t(changed.length === 1 ? 'addBooks.doneOne' : 'addBooks.done', {
                count: changed.length,
                shelf,
            }),
            ShelfPlacement.summary(changed, shelf, t, locale) + '.',
            ...(result.unchanged.length > 0
                ? [t('addBooks.unchanged', { count: result.unchanged.length })]
                : []),
        ].join(' ');
    }
}
