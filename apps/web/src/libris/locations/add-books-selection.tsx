import { useCallback, useMemo, useState } from 'react';
import { Outlet, useOutletContext, useParams } from 'react-router';
import type { BookListItemDto, BookLocationDto } from '../../../../../packages/contracts/src/http';

export interface ChosenBook {
    id: string;
    title: string;
    from: BookLocationDto | null;
}

export interface AddBooksSelection {
    chosen: ReadonlyMap<string, ChosenBook>;
    full: boolean;
    toggle(book: BookListItemDto): void;
    add(books: readonly BookListItemDto[]): void;
    clear(): void;
}

export const maximumChosen = 100;

export function AddBooksLayout() {
    const { shelfId = '' } = useParams();
    const [state, setState] = useState<{ shelfId: string; chosen: Map<string, ChosenBook> }>({
        shelfId,
        chosen: new Map(),
    });
    const chosen = useMemo(
        () => (state.shelfId === shelfId ? state.chosen : new Map<string, ChosenBook>()),
        [state, shelfId],
    );
    const change = useCallback(
        (edit: (next: Map<string, ChosenBook>) => void) =>
            setState((previous) => {
                const next = new Map(previous.shelfId === shelfId ? previous.chosen : []);

                edit(next);

                return { shelfId, chosen: next };
            }),
        [shelfId],
    );
    const selection = useMemo<AddBooksSelection>(() => {
        const put = (next: Map<string, ChosenBook>, book: BookListItemDto) => {
            if (next.size < maximumChosen && book.location?.shelfId !== shelfId) {
                next.set(book.id, { id: book.id, title: book.title, from: book.location });
            }
        };

        return {
            chosen,
            full: chosen.size >= maximumChosen,
            toggle: (book) =>
                change((next) => {
                    if (!next.delete(book.id)) {
                        put(next, book);
                    }
                }),
            add: (books) => change((next) => books.forEach((book) => put(next, book))),
            clear: () => change((next) => next.clear()),
        };
    }, [chosen, change, shelfId]);

    return <Outlet context={selection} />;
}

export function useAddBooksSelection(): AddBooksSelection {
    return useOutletContext<AddBooksSelection>();
}
