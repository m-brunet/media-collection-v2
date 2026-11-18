import { useEffect, useState } from 'react';
import type { BookcaseDto, BookcaseSpinesDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';

export function useBookcaseSpines(bookcase: BookcaseDto, enabled = true) {
    const [loaded, setLoaded] = useState<{ of: BookcaseDto; value: BookcaseSpinesDto } | null>(
        null,
    );
    const [failure, setFailure] = useState<{ of: BookcaseDto; key: MessageKey } | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let current = true;

        api.request<BookcaseSpinesDto>('/bookcases/' + bookcase.id + '/spines').then(
            (value) => {
                if (current) {
                    setLoaded({ of: bookcase, value });
                    setFailure(null);
                }
            },
            (error: unknown) =>
                current && setFailure({ of: bookcase, key: ApiErrorMessage.key(error) }),
        );

        return () => {
            current = false;
        };
    }, [bookcase, enabled]);

    return {
        spines: loaded?.of.id === bookcase.id ? loaded.value : null,
        failure: failure?.of.id === bookcase.id ? failure.key : null,
    };
}
