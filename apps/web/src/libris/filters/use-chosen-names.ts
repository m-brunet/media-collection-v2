import { useEffect, useState } from 'react';
import type { AuthorDto, CollectionDetailsDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';

// Names of the authors or collections chosen in a filter. The address carries only their ids,
// so a shared or bookmarked filter is named from the API. Unknown (removed) ones stay unnamed.
export function useChosenNames(
    field: 'author' | 'collection',
    values: readonly string[],
): ReadonlyMap<string, string> {
    const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
    const key = [...new Set(values.filter((value) => value !== 'none'))].sort().join(',');

    useEffect(() => {
        if (!key) {
            return;
        }

        let current = true;

        loadNames(field, key.split(',')).then(
            (found) => current && setNames(found),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [field, key]);

    return names;
}

async function loadNames(
    field: 'author' | 'collection',
    ids: readonly string[],
): Promise<Map<string, string>> {
    if (field === 'author') {
        const authors = await api.request<AuthorDto[]>(
            '/authors/by-id?' + ids.map((id) => 'id=' + encodeURIComponent(id)).join('&'),
        );

        return new Map(authors.map((author) => [author.id, author.name]));
    }

    const collections = await Promise.all(
        ids.map((id) =>
            api.request<CollectionDetailsDto>('/collections/' + encodeURIComponent(id)).then(
                (collection): [string, string] => [id, collection.name],
                () => null,
            ),
        ),
    );

    return new Map(collections.filter((entry) => entry !== null));
}
