import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useBlocker, useLocation, useNavigate } from 'react-router';
import type { BookcaseDto, BookLookupDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { BookDraftValues, DraftFieldSetter } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import type { CoverChoice } from '../../shared/book-form/cover-choice';
import { LookupFill } from '../../shared/book-form/lookup-fill.util';
import type { BookField } from '../../shared/book-form/use-book-save';
import { useBookSave } from '../../shared/book-form/use-book-save';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { LeafPage } from '../leaf-page';
import { useLeafResource } from '../use-leaf-resource';
import { LeafBookFields } from './leaf-book-fields';
import { LeafSaveQuestions } from './leaf-save-questions';

export type LookedUpBook = Extract<BookLookupDto, { kind: 'looked-up' }>;

// Navigation state of `/add`: only the scanned-ISBN screen sets it, after Find book.
export interface AddBookState {
    isbn: string;
    lookup: LookedUpBook;
}

// Navigation state of `/saved`.
export interface SavedBookState {
    title: string;
    followUpFailed: boolean;
}

// The values Find book found, as the form opens: every field from its preferred source.
function prefilled(isbn: string, lookup: LookedUpBook): BookDraftValues {
    const empty = { ...BookDraft.empty(), isbn };

    return LookupFill.apply(empty, LookupFill.defaults(lookup.fields, empty)).next;
}

function hasAdditional(values: BookDraftValues): boolean {
    return [values.publisher, values.publicationYear, values.summary, values.pageCount].some(
        (value) => value.trim() !== '',
    );
}

function AddBookForm({ isbn, lookup }: AddBookState) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [initial] = useState(() => prefilled(isbn, lookup));
    const [values, setValues] = useState(initial);
    const [cover, setCover] = useState<CoverChoice>({ file: null, removed: false });
    const [coverTouched, setCoverTouched] = useState(false);
    const [additionalOpen, setAdditionalOpen] = useState(() => hasAdditional(initial));
    const { resource: bookcases } = useLeafResource<BookcaseDto[]>('/bookcases');
    const leaving = useRef(false);
    const changed = coverTouched || !BookDraft.same(values, initial);
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            changed && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
    );
    const update = (changes: Partial<BookDraftValues>) =>
        setValues((current) => BookDraft.changed(current, changes));
    const set: DraftFieldSetter = (key, value) =>
        update({ [key]: value } as Partial<BookDraftValues>);
    const saving = useBookSave({
        book: null,
        initial,
        personal: true,
        cover,
        onAttempt: () => undefined,
        showAdditional: () => setAdditionalOpen(true),
        onSaved: (saved, { followUpFailed }) => {
            leaving.current = true;
            navigate('/saved', {
                replace: true,
                state: { title: saved.title, followUpFailed } satisfies SavedBookState,
            });
        },
    });
    const errorFor = (field: BookField) =>
        saving.failure?.field === field ? saving.failure.text : undefined;
    const firstCover = lookup.covers[0]?.token;

    // The first cover found is chosen at once, as the desktop review selects it first.
    useEffect(() => {
        if (!firstCover) {
            return;
        }

        let current = true;

        api.download('/books/lookups/covers/' + firstCover).then(
            (image) =>
                current &&
                setCover({
                    file: new File([image], 'cover', { type: image.type }),
                    removed: false,
                }),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [firstCover]);

    useEffect(() => {
        if (!changed) {
            return;
        }

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void saving.save(values);
    };
    const unavailable = lookup.unavailable.map(({ source }) =>
        source === 'bnf'
            ? t('source.bnf')
            : source === 'openlibrary'
              ? t('source.openlibrary')
              : source,
    );

    return (
        <LeafPage
            back={{ to: '/scan', label: t('leaf.back.scan') }}
            title={t('leaf.form.title')}
            intro={t('leaf.form.intro')}
        >
            {unavailable.length > 0 && (
                <Notice tone="warning">
                    {t('lookup.partial', { sources: unavailable.join(', ') })}
                </Notice>
            )}
            <form className="leaf-form" onSubmit={submit} noValidate>
                <LeafBookFields
                    values={values}
                    set={set}
                    update={update}
                    errorFor={errorFor}
                    lookup={lookup.fields}
                    covers={lookup.covers}
                    cover={cover}
                    setCover={(choice) => {
                        setCover(choice);
                        setCoverTouched(true);
                    }}
                    bookcases={bookcases.status === 'ready' ? bookcases.data : []}
                    additionalOpen={additionalOpen}
                    setAdditionalOpen={setAdditionalOpen}
                />
                {saving.failure && <Notice tone="error">{saving.failure.text}</Notice>}
                <Button type="submit" variant="primary" busy={saving.saving}>
                    {t('form.save')}
                </Button>
                <Button onClick={() => navigate('/')}>{t('common.cancel')}</Button>
                <p className="muted">{t('form.nothingAdded')}</p>
            </form>
            <LeafSaveQuestions
                question={saving.question}
                values={values}
                onChange={setValues}
                onSave={(draft, answers, target) => void saving.save(draft, answers, target)}
                onClose={saving.dismissQuestion}
            />
            {blocker.state === 'blocked' && (
                <Dialog
                    open
                    title={t('discard.title')}
                    onClose={() => blocker.reset()}
                    footer={
                        <>
                            <Button onClick={() => blocker.reset()}>{t('discard.keep')}</Button>
                            <Button variant="danger" onClick={() => blocker.proceed()}>
                                {t('discard.confirm')}
                            </Button>
                        </>
                    }
                >
                    <p>{t('discard.body')}</p>
                </Dialog>
            )}
        </LeafPage>
    );
}

// Review book after a successful scan and Find book. Opened any other way (a typed address,
// a reload), it returns home: the mobile add form needs a scan.
export function AddBookPage() {
    const state = useLocation().state as AddBookState | null;

    if (!state?.isbn || !state.lookup) {
        return <Navigate to="/" replace />;
    }

    return <AddBookForm isbn={state.isbn} lookup={state.lookup} />;
}
