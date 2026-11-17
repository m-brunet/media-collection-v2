import { useEffect, useState } from 'react';
import type { AuthorDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';

export function useAuthorSuggestions(typed: string): AuthorDto[] {
    const [found, setFound] = useState<{ search: string; authors: AuthorDto[] }>({
        search: '',
        authors: [],
    });
    const search = typed.trim();

    useEffect(() => {
        if (!search) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<AuthorDto[]>('/authors?search=' + encodeURIComponent(search)).then(
                (authors) => current && setFound({ search, authors }),
                () => current && setFound({ search, authors: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [search]);

    return found.search === search ? found.authors : [];
}
