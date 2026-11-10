import { useRef, useState } from 'react';
import type {
    BookDto,
    CoverageConflictDetails,
    PossibleDuplicateDetails,
    SimilarAuthorDetails,
    SimilarCollectionDetails,
    VolumeZeroDetails,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../api.util';
import { ApiErrorMessage } from '../api-error-message.util';
import { useI18n } from '../i18n/i18n-context';
import type { BookDraftValues, SaveOptions } from './book-draft.util';
import { BookDraft } from './book-draft.util';
import type { CoverChoice } from './cover-choice';

export type BookField =
    | 'isbn'
    | 'title'
    | 'authors'
    | 'publisher'
    | 'publication'
    | 'summary'
    | 'pageCount'
    | 'price'
    | 'note'
    | 'collection'
    | 'location'
    | 'tags';

export interface BookFormFailure {
    text: string;
    field: BookField | null;
    existingBookId: string | null;
}

export type SaveQuestion =
    | { kind: 'similar-author'; details: SimilarAuthorDetails }
    | { kind: 'possible-duplicate'; details: PossibleDuplicateDetails }
    | { kind: 'similar-collection'; details: SimilarCollectionDetails }
    | { kind: 'volume-zero'; details: VolumeZeroDetails }
    | { kind: 'coverage-conflict'; details: CoverageConflictDetails };

const fieldOfReason: Record<string, BookField> = {
    'isbn-required': 'isbn',
    'isbn-invalid': 'isbn',
    'isbn-taken': 'isbn',
    'title-invalid': 'title',
    'title-required': 'title',
    'authors-required': 'authors',
    'author-name-invalid': 'authors',
    'author-missing': 'authors',
    'publisher-invalid': 'publisher',
    'publication-month-without-year': 'publication',
    'publication-year-invalid': 'publication',
    'publication-month-invalid': 'publication',
    'summary-invalid': 'summary',
    'page-count-invalid': 'pageCount',
    'price-invalid': 'price',
    'note-invalid': 'note',
    'collection-name-invalid': 'collection',
    'collection-missing': 'collection',
    'volume-invalid': 'collection',
    'shelf-missing': 'location',
    'tag-missing': 'tags',
    'tag-name-invalid': 'tags',
};
const additionalFields: BookField[] = [
    'publisher',
    'publication',
    'summary',
    'pageCount',
    'price',
    'note',
];
const questionOfReason: Record<string, SaveQuestion['kind']> = {
    'author-similar': 'similar-author',
    'possible-duplicate': 'possible-duplicate',
    'collection-similar': 'similar-collection',
    'volume-zero-disabled': 'volume-zero',
    'coverage-conflict': 'coverage-conflict',
};

export function useBookSave({
    book,
    initial,
    personal,
    cover,
    onAttempt,
    showAdditional,
    onSaved,
}: {
    book: BookDto | null;
    initial: BookDraftValues;
    personal: boolean;
    cover: CoverChoice;
    onAttempt: () => void;
    showAdditional: () => void;
    // Once saved: `updated` when an existing record (the edited book or a planned one) was
    // saved rather than a new one created; `followUpFailed` when the reading status, the note or
    // the cover could not be saved afterwards.
    onSaved: (saved: BookDto, outcome: { updated: boolean; followUpFailed: boolean }) => void;
}) {
    const { t } = useI18n();
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<BookFormFailure | null>(null);
    const [question, setQuestion] = useState<SaveQuestion | null>(null);
    const answers = useRef<SaveOptions>({});
    // `target` is a planned record a new purchased book updates instead of being added.
    const save = async (draft: BookDraftValues, given: SaveOptions = {}, target?: string) => {
        const problem = BookDraft.collectionProblem(draft);

        setFailure(null);
        onAttempt();

        if (BookDraft.locationProblem(draft)) {
            setFailure({
                text: t('location.shelfRequired'),
                field: 'location',
                existingBookId: null,
            });

            return;
        }

        if (problem) {
            setFailure({
                text: t(
                    problem === 'volume-required'
                        ? 'form.volumeRequired'
                        : 'form.collectionNameRequired',
                ),
                field: 'collection',
                existingBookId: null,
            });

            return;
        }

        answers.current = { ...answers.current, ...given };
        setSaving(true);
        let saved: BookDto;

        try {
            const input = BookDraft.toInput(draft, answers.current);
            const id = target ?? book?.id;

            saved = id
                ? await api.request<BookDto>('/books/' + id, { method: 'PUT', body: input })
                : await api.request<BookDto>('/books', {
                      method: 'POST',
                      body: { ...input, read: personal && draft.read },
                  });
        } catch (error) {
            setSaving(false);
            refused(error);

            return;
        }

        let followUpFailed = false;

        try {
            await saveFollowUps(saved, draft, target !== undefined);
        } catch {
            followUpFailed = true;
        }

        onSaved(saved, { updated: Boolean(book || target), followUpFailed });
    };
    const refused = (error: unknown) => {
        const reason = error instanceof ApiError ? (error.reason ?? '') : '';
        const kind = questionOfReason[reason];

        if (['coverage-conflict', 'replacement-outdated'].includes(reason)) {
            answers.current = { ...answers.current, replacePlanned: undefined };
        }

        if (kind && error instanceof ApiError && error.details) {
            // The reason decides the shape of the details (see the HTTP contracts).
            setQuestion({ kind, details: error.details } as unknown as SaveQuestion);

            return;
        }

        const field = fieldOfReason[reason] ?? null;

        if (field && additionalFields.includes(field)) {
            showAdditional();
        }

        setFailure({
            text: t(ApiErrorMessage.key(error)),
            field,
            existingBookId:
                error instanceof ApiError && reason === 'isbn-taken'
                    ? String(error.details?.bookId ?? '') || null
                    : null,
        });
    };
    const saveFollowUps = async (
        saved: BookDto,
        draft: BookDraftValues,
        updatedPlanned: boolean,
    ) => {
        const path = '/books/' + saved.id;

        if (personal && (updatedPlanned || (book && draft.read !== initial.read))) {
            await api.request(path + '/reading', { method: 'PUT', body: { read: draft.read } });
        }

        const note = BookDraft.note(draft);

        if (personal && note !== BookDraft.note(initial)) {
            await (note === null
                ? api.request(path + '/note', { method: 'DELETE' })
                : api.request(path + '/note', { method: 'PUT', body: { text: note } }));
        }

        if (cover.file) {
            await api.request(path + '/cover', { method: 'PUT', file: cover.file });
        } else if (cover.removed && saved.hasCover) {
            await api.request(path + '/cover', { method: 'DELETE' });
        }
    };

    return {
        save,
        saving,
        failure,
        setFailure,
        question,
        dismissQuestion: () => setQuestion(null),
    };
}
