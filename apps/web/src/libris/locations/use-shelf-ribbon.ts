import { useEffect, useState } from 'react';
import type {
    BookListItemDto,
    BookListPageDto,
    ShelfDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { RibbonSizes } from './ribbon-sizes';

interface Ribbon {
    of: ShelfDto;
    total: number | null;
    items: BookListItemDto[];
    failure: MessageKey | null;
}

function fresh(shelf: ShelfDto): Ribbon {
    return { of: shelf, total: null, items: [], failure: null };
}

export function useShelfRibbon(shelf: ShelfDto, needed: number, active: boolean) {
    const [state, setState] = useState<Ribbon>(() => fresh(shelf));
    const ribbon = state.of === shelf ? state : fresh(shelf);
    const offset = ribbon.items.length;
    const missing =
        ribbon.failure === null &&
        (ribbon.total === null || offset < Math.min(ribbon.total, needed));

    useEffect(() => {
        if (!active || !missing) {
            return;
        }

        let current = true;
        const query = new URLSearchParams({
            location: 'shelf:' + shelf.id,
            sort: 'shelf',
            offset: String(offset),
            limit: String(Math.min(100, Math.max(RibbonSizes.pageSize, needed - offset))),
        });

        api.request<BookListPageDto>('/books?' + query.toString()).then(
            (page) =>
                current &&
                setState((previous) => {
                    const base = previous.of === shelf ? previous : fresh(shelf);

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
                current && setState({ ...fresh(shelf), failure: ApiErrorMessage.key(error) }),
        );

        return () => {
            current = false;
        };
    }, [shelf, active, missing, offset, needed]);

    return ribbon;
}
