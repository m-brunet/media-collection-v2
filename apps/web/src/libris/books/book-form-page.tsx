import type { FormEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';
import type { AuthorDto, BookDto } from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { useBookcases } from '../locations/use-bookcases';
import { BookAdditionalFields } from './book-additional-fields';
import { BookBreadcrumb } from './book-breadcrumb';
import type { BookDraftValues, DraftFieldSetter } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import { CorrectAuthorDialog, DiscardChangesDialog } from './book-form-dialogs';
import { BookMainFields } from './book-main-fields';
import { BookSaveQuestions } from './book-save-questions';
import type { CoverChoice } from '../../shared/book-form/cover-choice';
import { LocationField } from './location-field';
import { LookupConflictsDialog, LookupReviewDialog } from './lookup-dialogs';
import { LookupFill } from '../../shared/book-form/lookup-fill.util';
import { TagPicker } from './tag-picker';
import { useBookLookup } from './use-book-lookup';
import type { BookField } from '../../shared/book-form/use-book-save';
import { useBookSave } from '../../shared/book-form/use-book-save';

export function BookFormPage() {
    const { id } = useParams();

    return id ? <EditBook id={id} /> : <BookForm book={null} />;
}

function EditBook({ id }: { id: string }) {
    const { t } = useI18n();
    const [book, setBook] = useState<BookDto | null>(null);
    const [failure, setFailure] = useState<{ missing: boolean; text: string } | null>(null);

    useEffect(() => {
        api.request<BookDto>('/books/' + id).then(setBook, (error: unknown) =>
            setFailure({
                missing: error instanceof ApiError && [400, 404].includes(error.status),
                text: t(ApiErrorMessage.key(error)),
            }),
        );
    }, [id, t]);

    if (failure?.missing) {
        return (
            <EmptyState
                icon="books"
                title={t('details.missing')}
                body={t('details.missingBody')}
                action={<Link to="/books">{t('details.back')}</Link>}
            />
        );
    }

    if (failure) {
        return <Notice tone="error">{failure.text}</Notice>;
    }

    return book ? (
        <BookForm key={book.id} book={book} />
    ) : (
        <LoadingState label={t('common.loading')} />
    );
}

function BookForm({ book }: { book: BookDto | null }) {
    const { t, locale } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const [parameters] = useSearchParams();
    const sectionId = useId();
    const [initial, setInitial] = useState(() => {
        const collection = parameters.get('collection');

        if (book) {
            return BookDraft.fromBook(book, locale);
        }

        return collection ? BookDraft.inCollection(collection) : BookDraft.empty();
    });
    const [values, setValues] = useState<BookDraftValues>(initial);
    const [cover, setCover] = useState<CoverChoice>({ file: null, removed: false });
    const [expanded, setExpanded] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [correcting, setCorrecting] = useState<AuthorDto | null>(null);
    // Set once the book is saved or the person chose to leave, so navigation is not blocked.
    const leaving = useRef(false);
    const changed = !BookDraft.same(initial, values) || cover.file !== null || cover.removed;
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            changed && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
    );
    const personal = account?.role !== 'guest';
    const { bookcases } = useBookcases();
    const update = (changes: Partial<BookDraftValues>) =>
        setValues((current) => BookDraft.changed(current, changes));
    const set: DraftFieldSetter = (key, value) =>
        update({ [key]: value } as Partial<BookDraftValues>);
    const leave = (path: string, state?: unknown) => {
        leaving.current = true;
        navigate(path, { state });
    };
    const saving = useBookSave({
        book,
        initial,
        personal,
        cover,
        onAttempt: () => setNotice(null),
        showAdditional: () => setExpanded(true),
        onSaved: (saved, { updated, followUpFailed }) =>
            leave('/books/' + saved.id + (updated ? '' : '/added'), { followUpFailed }),
    });
    const lookup = useBookLookup({
        values,
        setValues,
        cover,
        setCover,
        openBook: (bookId) => leave('/books/' + bookId),
        showIsbnProblem: (text) =>
            saving.setFailure(text ? { text, field: 'isbn', existingBookId: null } : null),
        showAdditional: () => setExpanded(true),
    });
    const errorFor = (field: BookField) =>
        saving.failure?.field === field ? saving.failure.text : undefined;

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
    const actions = (
        <Button type="submit" variant="primary" busy={saving.saving} form={sectionId}>
            {book ? t('form.saveChanges') : t('form.save')}
        </Button>
    );

    return (
        <>
            <PageHeader
                title={book ? t('form.editTitle') : t('form.addTitle')}
                intro={book ? undefined : t('form.addIntro')}
                breadcrumb={book ? <BookBreadcrumb title={book.title} /> : undefined}
                actions={actions}
            />
            <form id={sectionId} className="stack" onSubmit={submit} noValidate>
                {notice && <Notice tone="success">{notice}</Notice>}
                {lookup.message && (
                    <Notice
                        tone={lookup.message.tone}
                        icon={lookup.message.offline ? 'lookup-offline' : undefined}
                    >
                        {lookup.message.text}
                    </Notice>
                )}
                <BookMainFields
                    book={book}
                    values={values}
                    set={set}
                    update={update}
                    errorFor={errorFor}
                    personal={personal}
                    existingBookId={saving.failure?.existingBookId ?? null}
                    find={
                        book
                            ? null
                            : {
                                  busy: lookup.busy,
                                  retry: lookup.message?.retry ?? false,
                                  onFind: () => void lookup.find(),
                              }
                    }
                    cover={cover}
                    onCoverChange={setCover}
                    onCorrectAuthor={book ? setCorrecting : undefined}
                />
                <Panel label={t('form.organisation')}>
                    <div className="form">
                        {bookcases && (
                            <LocationField
                                bookcases={bookcases}
                                bookcaseId={values.bookcaseId}
                                shelfId={values.shelfId}
                                error={errorFor('location')}
                                onChange={(changes) =>
                                    setValues((current) => ({ ...current, ...changes }))
                                }
                            />
                        )}
                        <TagPicker
                            tags={values.tags}
                            error={errorFor('tags')}
                            onChange={(tags) => set('tags', tags)}
                        />
                    </div>
                </Panel>
                <BookAdditionalFields
                    id={sectionId + '-additional'}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                    values={values}
                    set={set}
                    errorFor={errorFor}
                    personal={personal}
                />
                {saving.failure && <Notice tone="error">{saving.failure.text}</Notice>}
                <div className="actions">
                    {actions}
                    <Button
                        variant="secondary"
                        onClick={() => navigate(book ? '/books/' + book.id : '/books')}
                    >
                        {t('common.cancel')}
                    </Button>
                    <span className="muted">
                        {book ? t('form.appliedOnSave') : t('form.nothingAdded')}
                    </span>
                </div>
            </form>
            {lookup.review && (
                <LookupReviewDialog
                    key={lookup.review.isbn13}
                    fields={lookup.review.fields}
                    covers={lookup.review.covers}
                    keepsGeneratedTitle={LookupFill.keepsGeneratedTitle(
                        values,
                        lookup.review.fields,
                    )}
                    onUse={(selection, token) => void lookup.use(selection, token)}
                    onClose={lookup.closeReview}
                />
            )}
            {lookup.replacing && (
                <LookupConflictsDialog
                    conflicts={lookup.replacing.conflicts}
                    onApply={lookup.replace}
                    onClose={lookup.closeReplacing}
                />
            )}
            <BookSaveQuestions
                question={saving.question}
                values={values}
                creating={!book}
                onChange={setValues}
                onSave={(draft, answers, target) => void saving.save(draft, answers, target)}
                onOpenBook={(bookId) => leave('/books/' + bookId)}
                onClose={saving.dismissQuestion}
            />
            <CorrectAuthorDialog
                author={correcting}
                onClose={() => setCorrecting(null)}
                onCorrected={(author) => {
                    const rename = (list: BookDraftValues['authors']) =>
                        list.map((entry) =>
                            entry.id === author.id ? { ...entry, name: author.name } : entry,
                        );

                    setCorrecting(null);
                    setValues((current) => ({ ...current, authors: rename(current.authors) }));
                    setInitial((current) => ({ ...current, authors: rename(current.authors) }));
                    setNotice(t('correct.done'));
                }}
            />
            <DiscardChangesDialog
                open={blocker.state === 'blocked'}
                onKeep={() => blocker.reset?.()}
                onDiscard={() => blocker.proceed?.()}
            />
        </>
    );
}
