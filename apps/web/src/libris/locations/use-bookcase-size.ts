import { useState } from 'react';
import type { BookcaseDto, BookcaseSize } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';

interface Pending {
    bookcaseId: string;
    from: BookcaseSize;
    size: BookcaseSize;
}

export function useBookcaseSize(bookcase: BookcaseDto, onSaved: () => void) {
    const [pending, setPending] = useState<Pending | null>(null);
    const [failure, setFailure] = useState<{ bookcaseId: string; key: MessageKey } | null>(null);
    const chosen =
        pending?.bookcaseId === bookcase.id && pending.from === bookcase.size ? pending.size : null;
    const choose = (size: BookcaseSize) => {
        const request: Pending = { bookcaseId: bookcase.id, from: bookcase.size, size };

        setPending(request);
        setFailure(null);
        api.request<BookcaseDto>('/bookcases/' + bookcase.id, {
            method: 'PATCH',
            body: { size },
        }).then(onSaved, (error: unknown) => {
            setPending((current) => (current === request ? null : current));
            setFailure({ bookcaseId: request.bookcaseId, key: ApiErrorMessage.key(error) });
        });
    };

    return {
        size: chosen ?? bookcase.size,
        failure: failure?.bookcaseId === bookcase.id ? failure.key : null,
        choose,
    };
}
