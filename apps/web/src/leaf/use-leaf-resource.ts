import { useCallback, useEffect, useState } from 'react';
import { api } from '../shared/api.util';

export type LeafResource<T> =
    | { status: 'loading' }
    | { status: 'ready'; data: T }
    | { status: 'failed'; error: unknown };

export function useLeafResource<T>(path: string) {
    const [resource, setResource] = useState<LeafResource<T>>({ status: 'loading' });
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((value) => value + 1), []);

    useEffect(() => {
        let current = true;

        api.request<T>(path).then(
            (data) => current && setResource({ status: 'ready', data }),
            (error: unknown) => current && setResource({ status: 'failed', error }),
        );

        return () => {
            current = false;
        };
    }, [path, version]);

    return { resource, reload };
}
