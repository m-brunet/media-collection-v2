import { useRef, useState } from 'react';
import type {
    BookDto,
    CoverageConflictDetails,
    PossibleDuplicateDetails,
    SimilarAuthorDetails,
    SimilarCollectionDetails,
    VolumeZeroDetails,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { BookDraftValues, SaveOptions } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import type { CoverChoice } from './cover-picker';

// The form fields a refusal can point at.
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

// A refusal shown under the form, and beside its field when it is about one.
export interface BookFormFailure {
    text: string;
    field: BookField | null;
    // The existing record of an already saved ISBN.
    existingBookId: string | null;
}

// A question the server asks before saving (a similar author, a possible duplicate…). The
// person's answer leads to a new attempt; see `BookSaveQuestions`.
export type SaveQuestion =
    | { kind: 'similar-author'; details: SimilarAuthorDetails }
    | { kind: 'possible-duplicate'; details: PossibleDuplicateDetails }
    | { kind: 'similar-collection'; details: SimilarCollectionDetails }
    | { kind: 'volume-zero'; details: VolumeZeroDetails }
    | { kind: 'coverage-conflict'; details: CoverageConflictDetails };

// Which field a server refusal is about, so the message appears beside it.
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
// Fields inside Additional information, opened when a refusal is about one of them.
const additionalFields: BookField[] = [
    'publisher',
    'publication',
    'summary',
    'pageCount',
    'price',
    'note',
];
// Refusals that are questions for the person rather than errors.
const questionOfReason: Record<string, SaveQuestion['kind']> = {
    'author-similar': 'similar-author',
    'possible-duplicate': 'possible-duplicate',
    'collection-similar': 'similar-collection',
    'volume-zero-disabled': 'volume-zero',
    'coverage-conflict': 'coverage-conflict',
};

// Saving the book form: the shared information first, where a refusal keeps the draft and is
// shown as an error or asked as a question; then the personal parts and the cover, whose failure
// is reported after the book is saved.
export function useBookSave({
    book,
    initial,
    personal,
    cover,
    onAttempt,
    showAdditional,
    leave,
}: {
    // The book being edited, or null when adding one.
    book: BookDto | null;
    // The draft as the form opened, to send only the personal parts that changed.
    initial: BookDraftValues;
    // Whether the account has a reading status and notes (not a Guest).
    personal: boolean;
    cover: CoverChoice;
    // Called as each attempt starts.
    onAttempt: () => void;
    showAdditional: () => void;
    leave: (path: string, state?: unknown) => void;
}) {
    const { t } = useI18n();
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<BookFormFailure | null>(null);
    const [question, setQuestion] = useState<SaveQuestion | null>(null);
    // Answers already given to questions, kept for the following attempts.
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

        leave(book || target ? '/books/' + saved.id : '/books/' + saved.id + '/added', {
            followUpFailed,
        });
    };
    // A refusal of the shared information: a question to ask, or an error to show.
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
    // The reading status, the personal note and the cover, once the book exists.
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
