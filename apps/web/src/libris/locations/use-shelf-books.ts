import { useEffect, useState } from 'react';
import type {
    BookListItemDto,
    BookListPageDto,
    ShelfDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';

const pageSize = 24;

interface ShelfBooks {
    of: string;
    total: number | null;
    items: BookListItemDto[];
    failure: MessageKey | null;
}

function fresh(shelfId: string): ShelfBooks {
    return { of: shelfId, total: null, items: [], failure: null };
}

export function useShelfBooks(shelf: ShelfDto, needed: number, active: boolean) {
    const [state, setState] = useState<ShelfBooks>(() => fresh(shelf.id));
    const books = state.of === shelf.id ? state : fresh(shelf.id);
    const offset = books.items.length;
    const missing =
        books.failure === null && (books.total === null || offset < Math.min(books.total, needed));

    useEffect(() => {
        if (!active || !missing) {
            return;
        }

        let current = true;
        const query = new URLSearchParams({
            location: 'shelf:' + shelf.id,
            sort: 'shelf',
            offset: String(offset),
            limit: String(Math.min(100, Math.max(pageSize, needed - offset))),
        });

        api.request<BookListPageDto>('/books?' + query.toString()).then(
            (page) =>
                current &&
                setState((previous) => {
                    const base = previous.of === shelf.id ? previous : fresh(shelf.id);

                    if (base.items.length !== offset) {
                        return base;
                    }

                    const items = [...base.items, ...page.items];

                    return {
                        ...base,
                        items,
                        total: page.items.length === 0 ? items.length : page.total,
                    };
                }),
            (error: unknown) =>
                current && setState({ ...fresh(shelf.id), failure: ApiErrorMessage.key(error) }),
        );

        return () => {
            current = false;
        };
    }, [shelf.id, active, missing, offset, needed]);

    return {
        ...books,
        remove: (bookId: string) =>
            setState((previous) =>
                previous.of !== shelf.id
                    ? previous
                    : {
                          ...previous,
                          items: previous.items.filter((book) => book.id !== bookId),
                          total: previous.total === null ? null : previous.total - 1,
                      },
            ),
    };
}
