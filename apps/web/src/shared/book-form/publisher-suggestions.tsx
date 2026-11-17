import { useEffect, useState } from 'react';
import { api } from '../api.util';
import { BookDraft } from './book-draft.util';

export function PublisherSuggestions({ id, typed }: { id: string; typed: string }) {
    const key = BookDraft.nameKey(typed);
    const [found, setFound] = useState<{ key: string; names: string[] } | null>(null);
    const names = key && found?.key === key ? found.names : [];

    useEffect(() => {
        if (!key) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<string[]>('/publishers?search=' + encodeURIComponent(typed.trim())).then(
                (result) => current && setFound({ key, names: result }),
                () => current && setFound({ key, names: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [key, typed]);

    return (
        <datalist id={id}>
            {names.map((name) => (
                <option key={name} value={name} />
            ))}
        </datalist>
    );
}
