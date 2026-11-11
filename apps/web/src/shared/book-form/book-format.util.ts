import type {
    BookCategory,
    BookOwnership,
    BookSort,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../i18n/catalog-en';

export interface SortChoice {
    sort: BookSort;
    direction: 'asc' | 'desc';
    label: MessageKey;
}

export class BookFormat {
    static readonly categories: BookCategory[] = ['books', 'manga', 'comics'];
    static readonly ownerships: BookOwnership[] = ['owned', 'not-owned'];
    static readonly sorts: SortChoice[] = [
        { sort: 'title', direction: 'asc', label: 'books.sort.titleAsc' },
        { sort: 'title', direction: 'desc', label: 'books.sort.titleDesc' },
        { sort: 'added', direction: 'desc', label: 'books.sort.addedDesc' },
        { sort: 'added', direction: 'asc', label: 'books.sort.addedAsc' },
        { sort: 'published', direction: 'desc', label: 'books.sort.publishedDesc' },
        { sort: 'published', direction: 'asc', label: 'books.sort.publishedAsc' },
    ];

    static cover(bookId: string, version: string): string {
        return '/api/books/' + bookId + '/cover?v=' + encodeURIComponent(version);
    }

    static category(category: BookCategory): MessageKey {
        return ('category.' + category) as MessageKey;
    }

    static ownership(ownership: BookOwnership): MessageKey {
        return ownership === 'owned' ? 'status.owned' : 'status.notOwned';
    }

    static reading(read: boolean): MessageKey {
        return read ? 'status.read' : 'status.notRead';
    }

    static price(cents: number, locale: string): string {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    }

    static priceInput(cents: number, locale: string): string {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: false,
        }).format(cents / 100);
    }

    static publication(year: number, month: number | null, locale: string): string {
        if (month === null) {
            return String(year);
        }

        return new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        }).format(Date.UTC(year, month - 1, 1));
    }

    static monthName(month: number, locale: string): string {
        return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
            Date.UTC(2000, month - 1, 1),
        );
    }
}
