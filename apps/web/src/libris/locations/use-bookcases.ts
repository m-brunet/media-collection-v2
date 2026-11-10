import { useCallback, useEffect, useState } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';

export function useBookcases() {
    const [bookcases, setBookcases] = useState<BookcaseDto[] | null>(null);
    const [failure, setFailure] = useState<MessageKey | null>(null);
    const [version, setVersion] = useState(0);
    const reload = useCallback(() => setVersion((current) => current + 1), []);

    useEffect(() => {
        let current = true;

        api.request<BookcaseDto[]>('/bookcases').then(
            (found) => {
                if (current) {
                    setBookcases(found);
                    setFailure(null);
                }
            },
            (error: unknown) => current && setFailure(ApiErrorMessage.key(error)),
        );

        return () => {
            current = false;
        };
    }, [version]);

    return { bookcases, failure, reload };
}
