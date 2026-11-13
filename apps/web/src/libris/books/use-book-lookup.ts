import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { AuthorSpellingDto, BookLookupDto } from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { BookDraftValues } from '../../shared/book-form/book-draft.util';
import type { CoverChoice } from '../../shared/book-form/cover-choice';
import { useSourceNames } from '../../shared/book-form/use-source-names';
import type {
    LookupConflict,
    LookupField,
    LookupSelection,
} from '../../shared/book-form/lookup-fill.util';
import { LookupFill } from '../../shared/book-form/lookup-fill.util';
import { Required } from '../../shared/required.util';

export type LookedUpBook = Extract<BookLookupDto, { kind: 'looked-up' }>;

export interface LookupMessage {
    tone: 'info' | 'warning' | 'success';
    text: string;
    retry: boolean;
    offline?: boolean;
}

export function useBookLookup({
    values,
    setValues,
    cover,
    setCover,
    openBook,
    showIsbnProblem,
    showAdditional,
}: {
    values: BookDraftValues;
    setValues: Dispatch<SetStateAction<BookDraftValues>>;
    cover: CoverChoice;
    setCover(choice: CoverChoice): void;
    openBook(bookId: string): void;
    showIsbnProblem(text: string | null): void;
    showAdditional(): void;
}) {
    const { t } = useI18n();
    const sourceNames = useSourceNames();
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<LookupMessage | null>(null);
    const [review, setReview] = useState<LookedUpBook | null>(null);
    const [spellings, setSpellings] = useState<AuthorSpellingDto[]>([]);
    const [replacing, setReplacing] = useState<{
        selection: LookupSelection;
        conflicts: LookupConflict[];
    } | null>(null);
    const find = async () => {
        setBusy(true);
        setMessage(null);
        showIsbnProblem(null);

        try {
            const result = await api.request<BookLookupDto>('/books/lookups', {
                method: 'POST',
                body: { isbn: values.isbn },
            });

            if (result.kind === 'existing') {
                openBook(result.bookId);
            } else if (result.found) {
                setReview(result);
            } else if (result.unavailable.length > 0) {
                setMessage({
                    tone: 'warning',
                    text: t('lookup.unavailable', { sources: unavailableNames(result) }),
                    retry: true,
                    offline: true,
                });
            } else {
                setMessage({ tone: 'info', text: t('lookup.noResult'), retry: false });
            }
        } catch (error) {
            if (error instanceof ApiError && error.reason === 'isbn-invalid') {
                showIsbnProblem(t(ApiErrorMessage.key(error)));
            } else {
                setMessage({
                    tone: 'warning',
                    text: t('lookup.unavailableAll'),
                    retry: true,
                    offline: true,
                });
            }
        } finally {
            setBusy(false);
        }
    };
    const use = async (selection: LookupSelection, coverToken: string | null) => {
        const result = Required.value(review, 'a looked-up book is under review');
        const { next, conflicts } = LookupFill.apply(values, selection);
        const additional = [
            selection.publisher,
            selection.publication,
            selection.pageCount,
            selection.summary,
        ];

        setReview(null);
        setValues(next);
        setSpellings(result.authorSpellings);

        if (additional.some((value) => value !== null)) {
            showAdditional();
        }

        setMessage(
            result.unavailable.length > 0
                ? {
                      tone: 'warning',
                      text: t('lookup.partial', { sources: unavailableNames(result) }),
                      retry: false,
                      offline: true,
                  }
                : { tone: 'success', text: t('lookup.applied'), retry: false },
        );

        if (conflicts.length > 0) {
            setReplacing({ selection, conflicts });
        }

        if (coverToken && !cover.file) {
            try {
                const image = await api.download('/books/lookups/covers/' + coverToken);

                setCover({
                    file: new File([image], 'cover', { type: image.type }),
                    removed: false,
                });
            } catch {
                // Justified: the book can still be saved; the person is told to choose a cover.
                setMessage({ tone: 'warning', text: t('lookup.coverFailed'), retry: false });
            }
        }
    };
    const replace = (fields: LookupField[]) => {
        setValues((current) =>
            LookupFill.replace(
                current,
                Required.value(replacing, 'a replacement is being chosen').selection,
                fields,
            ),
        );
        setReplacing(null);
    };
    const unavailableNames = (result: LookedUpBook) =>
        sourceNames(result.unavailable.map(({ source }) => source));

    return {
        busy,
        message,
        find,
        review,
        use,
        spellings,
        closeReview: () => setReview(null),
        replacing,
        replace,
        closeReplacing: () => setReplacing(null),
    };
}
