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
import { useSourceNames } from '../../shared/book-form/use-source-names';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { LeafPage } from '../leaf-page';
import { useLeafResource } from '../use-leaf-resource';
import { LeafAddMemory } from './leaf-add-memory.util';
import { LeafBookFields } from './leaf-book-fields';
import { LeafSaveQuestions } from './leaf-save-questions';

export type LookedUpBook = Extract<BookLookupDto, { kind: 'looked-up' }>;

// Navigation state of `/add`: only the scanned-ISBN screen sets it, after Find book.
export interface AddBookState {
    isbn: string;
    lookup: LookedUpBook;
}

export interface SavedBookState {
    title: string;
    followUpFailed: boolean;
}

interface AddBookFormProps extends AddBookState {
    accountId: string;
    bookcases: BookcaseDto[];
}

function AddBookForm({ isbn, lookup, accountId, bookcases }: AddBookFormProps) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const sourceNames = useSourceNames();
    // The last saved book's shelf (if it still exists), category and reading status first, the
    // lookup on top.
    const [initial] = useState(() =>
        LeafAddMemory.located(
            LookupFill.prefilled(
                { ...BookDraft.empty(), ...LeafAddMemory.read(accountId), isbn },
                lookup.fields,
            ),
            bookcases,
        ),
    );
    const [values, setValues] = useState(initial);
    const [cover, setCover] = useState<CoverChoice>({ file: null, removed: false });
    const [coverTouched, setCoverTouched] = useState(false);
    const [additionalOpen, setAdditionalOpen] = useState(() => BookDraft.hasAdditional(initial));
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

            LeafAddMemory.write(accountId, saved);

            navigate('/saved', {
                replace: true,
                state: { title: saved.title, followUpFailed } satisfies SavedBookState,
            });
        },
    });
    const errorFor = (field: BookField) =>
        saving.failure?.field === field ? saving.failure.text : undefined;
    const firstCover = lookup.covers[0]?.token;

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
    const unavailable = sourceNames(lookup.unavailable.map(({ source }) => source));

    return (
        <LeafPage
            back={{ to: '/scan', label: t('leaf.back.scan') }}
            title={t('leaf.form.title')}
            intro={t('leaf.form.intro')}
        >
            {unavailable && (
                <Notice tone="warning" icon="lookup-offline">
                    {t('lookup.partial', { sources: unavailable })}
                </Notice>
            )}
            <form className="leaf-form" onSubmit={submit} noValidate>
                <LeafBookFields
                    values={values}
                    set={set}
                    update={update}
                    errorFor={errorFor}
                    lookup={lookup.fields}
                    authorSpellings={lookup.authorSpellings}
                    covers={lookup.covers}
                    cover={cover}
                    setCover={(choice) => {
                        setCover(choice);
                        setCoverTouched(true);
                    }}
                    bookcases={bookcases}
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

// Opened any other way (a typed address,
// a reload), it returns home: the mobile add form needs a scan.
export function AddBookPage() {
    const { t } = useI18n();
    const state = useLocation().state as AddBookState | null;
    const { account } = useSession();
    const { resource: bookcases } = useLeafResource<BookcaseDto[]>('/bookcases');

    if (!state?.isbn || !state.lookup) {
        return <Navigate to="/" replace />;
    }

    // Leaf shows its pages once signed in; the form starts from this account's last choices.
    if (!account) {
        return null;
    }

    // The shelves are known before the form starts, so a remembered shelf deleted since is dropped.
    if (bookcases.status === 'loading') {
        return <LoadingState label={t('leaf.form.opening')} />;
    }

    return (
        <AddBookForm
            isbn={state.isbn}
            lookup={state.lookup}
            accountId={account.id}
            bookcases={bookcases.status === 'ready' ? bookcases.data : []}
        />
    );
}
