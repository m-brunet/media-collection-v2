import { useEffect, useState } from 'react';
import { api } from '../../shared/api.util';

interface NamedEntry {
    id: string;
    name: string;
}

export function useNameSearch(resource: '/authors' | '/tags', typed: string): NamedEntry[] {
    const [found, setFound] = useState<{ search: string; names: NamedEntry[] }>({
        search: '',
        names: [],
    });
    const search = typed.trim();

    useEffect(() => {
        if (!search) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<NamedEntry[]>(resource + '?search=' + encodeURIComponent(search)).then(
                (names) => current && setFound({ search, names }),
                () => current && setFound({ search, names: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [resource, search]);

    return found.search === search ? found.names : [];
}
