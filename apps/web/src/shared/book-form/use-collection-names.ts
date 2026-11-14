import { useEffect, useState } from 'react';
import type { CollectionNameDto } from '../../../../../packages/contracts/src/http';
import { api } from '../api.util';
import type { BookDraftValues } from './book-draft.util';

export function useCollectionNames(values: BookDraftValues): CollectionNameDto[] {
    const [names, setNames] = useState<CollectionNameDto[]>([]);
    const typed = values.collectionName.trim();

    useEffect(() => {
        if (!values.inCollection) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<CollectionNameDto[]>(
                '/collections/names?search=' + encodeURIComponent(typed),
            ).then(
                (found) => current && setNames(found),
                () => current && setNames([]),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [typed, values.inCollection]);

    return names;
}
