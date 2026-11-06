import type { FormEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';
import type {
    AuthorDto,
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
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { SelectField } from '../../shared/ui/select-field';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { TextAreaField, TextField } from '../../shared/ui/text-field';
import { AuthorPicker } from './author-picker';
import { BookBreadcrumb } from './book-breadcrumb';
import type { BookDraftValues, SaveOptions } from './book-draft.util';
import { BookDraft } from './book-draft.util';
import {
    CorrectAuthorDialog,
    CoverageConflictDialog,
    DiscardChangesDialog,
    PossibleDuplicateDialog,
    SimilarAuthorDialog,
    SimilarCollectionDialog,
    VolumeZeroDialog,
} from './book-form-dialogs';
import { CollectionField } from './collection-field';
import { LocationField } from './location-field';
import { TagPicker } from './tag-picker';
import { useBookcases } from '../locations/use-bookcases';
import { BookFormat } from './book-format.util';
import type { CoverChoice } from './cover-picker';
import { CoverPicker } from './cover-picker';

type Field =
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

// Which field a server refusal is about, so the message appears beside it.
const fieldOfReason: Record<string, Field> = {
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
const additionalFields: Field[] = [
    'publisher',
    'publication',
    'summary',
    'pageCount',
    'price',
    'note',
];

interface Failure {
    text: string;
    field: Field | null;
    // The existing record of an already saved ISBN.
    existingBookId: string | null;
}

// Add and edit form. Nothing is saved before the person confirms; leaving with unsaved changes
// asks first. The cover, the creator's reading status and note are saved right after the book.
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
    // A lent book stays Owned until its return is recorded.
    const lentTo = book?.loan?.receiverName ?? null;
    const [cover, setCover] = useState<CoverChoice>({ file: null, removed: false });
    const [expanded, setExpanded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [similar, setSimilar] = useState<SimilarAuthorDetails | null>(null);
    const [duplicate, setDuplicate] = useState<PossibleDuplicateDetails | null>(null);
    const [correcting, setCorrecting] = useState<AuthorDto | null>(null);
    const [similarCollection, setSimilarCollection] = useState<SimilarCollectionDetails | null>(
        null,
    );
    const [volumeZero, setVolumeZero] = useState<VolumeZeroDetails | null>(null);
    const [coverage, setCoverage] = useState<CoverageConflictDetails | null>(null);
    // Answers already given in dialogs, kept for the following attempts.
    const answers = useRef<SaveOptions>({});
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
    const set = <K extends keyof BookDraftValues>(key: K, value: BookDraftValues[K]) =>
        update({ [key]: value } as Partial<BookDraftValues>);
    const titleOptional = BookDraft.titleOptional(values);
    const generatedTitle = BookDraft.generatedTitle(values);
    const errorFor = (field: Field) => (failure?.field === field ? failure.text : undefined);

    useEffect(() => {
        if (!changed) {
            return;
        }

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);

    const leave = (path: string, state?: unknown) => {
        leaving.current = true;
        navigate(path, { state });
    };
    // Saves the shared information first; a refusal keeps the draft. The personal parts and the
    // cover follow, and a failure there is reported after the book is saved. `target` is a
    // planned record a new purchased book updates instead of being added.
    const save = async (draft: BookDraftValues, given: SaveOptions = {}, target?: string) => {
        const problem = BookDraft.collectionProblem(draft);

        setFailure(null);
        setNotice(null);

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

            if (
                error instanceof ApiError &&
                ['coverage-conflict', 'replacement-outdated'].includes(error.reason ?? '')
            ) {
                answers.current = { ...answers.current, replacePlanned: undefined };
            }

            if (
                error instanceof ApiError &&
                error.reason === 'coverage-conflict' &&
                error.details
            ) {
                setCoverage(error.details as unknown as CoverageConflictDetails);
            } else if (
                error instanceof ApiError &&
                error.reason === 'collection-similar' &&
                error.details
            ) {
                setSimilarCollection(error.details as unknown as SimilarCollectionDetails);
            } else if (
                error instanceof ApiError &&
                error.reason === 'volume-zero-disabled' &&
                error.details
            ) {
                setVolumeZero(error.details as unknown as VolumeZeroDetails);
            } else if (
                error instanceof ApiError &&
                error.reason === 'author-similar' &&
                error.details
            ) {
                setSimilar(error.details as unknown as SimilarAuthorDetails);
            } else if (
                error instanceof ApiError &&
                error.reason === 'possible-duplicate' &&
                error.details
            ) {
                setDuplicate(error.details as unknown as PossibleDuplicateDetails);
            } else {
                const field =
                    error instanceof ApiError && error.reason
                        ? (fieldOfReason[error.reason] ?? null)
                        : null;

                if (field && additionalFields.includes(field)) {
                    setExpanded(true);
                }

                setFailure({
                    text: t(ApiErrorMessage.key(error)),
                    field,
                    existingBookId:
                        error instanceof ApiError && error.reason === 'isbn-taken'
                            ? String(error.details?.bookId ?? '') || null
                            : null,
                });
            }

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
    const submit = (event: FormEvent) => {
        event.preventDefault();
        void save(values);
    };
    const actions = (
        <Button type="submit" variant="primary" busy={saving} form={sectionId}>
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
                <Panel label={t('form.main')}>
                    <div className="book-form__main">
                        <div className="form">
                            <div className="book-form__isbn">
                                <TextField
                                    label={t('form.isbn')}
                                    hint={t('form.isbnHint')}
                                    error={errorFor('isbn')}
                                    required={!values.noIsbn}
                                    disabled={values.noIsbn}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={40}
                                    value={values.noIsbn ? '' : values.isbn}
                                    onChange={(event) => set('isbn', event.target.value)}
                                />
                                {failure?.existingBookId && (
                                    <Link
                                        to={'/books/' + failure.existingBookId}
                                        className="book-form__existing"
                                    >
                                        {t('form.openExisting')}
                                    </Link>
                                )}
                            </div>
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={values.noIsbn}
                                    onChange={(event) => set('noIsbn', event.target.checked)}
                                />
                                {t('form.noIsbn')}
                            </label>
                            <TextField
                                label={t('form.title')}
                                required={!titleOptional}
                                hint={
                                    titleOptional
                                        ? generatedTitle
                                            ? t('form.titleGenerated', { title: generatedTitle })
                                            : t('form.titleGeneratedLater')
                                        : undefined
                                }
                                maxLength={300}
                                error={errorFor('title')}
                                value={values.title}
                                onChange={(event) => set('title', event.target.value)}
                            />
                            <AuthorPicker
                                authors={values.authors}
                                error={errorFor('authors')}
                                onChange={(authors) => set('authors', authors)}
                                onCorrect={book ? setCorrecting : undefined}
                            />
                            <div className="book-form__row">
                                <SelectField
                                    label={t('form.category')}
                                    value={values.category}
                                    options={BookFormat.categories.map((category) => ({
                                        value: category,
                                        label: t(BookFormat.category(category)),
                                    }))}
                                    onChange={(event) =>
                                        set(
                                            'category',
                                            event.target.value as BookDraftValues['category'],
                                        )
                                    }
                                />
                                <SelectField
                                    label={t('form.ownership')}
                                    required
                                    hint={
                                        lentTo
                                            ? t('form.ownershipLent', { name: lentTo })
                                            : undefined
                                    }
                                    value={values.ownership}
                                    options={BookFormat.ownerships.map((ownership) => ({
                                        value: ownership,
                                        label: t(BookFormat.ownership(ownership)),
                                        // A lent book stays Owned until its return is recorded.
                                        disabled: lentTo !== null && ownership === 'not-owned',
                                    }))}
                                    onChange={(event) =>
                                        set(
                                            'ownership',
                                            event.target.value as BookDraftValues['ownership'],
                                        )
                                    }
                                />
                                {personal && (
                                    <SelectField
                                        label={t('form.reading')}
                                        required
                                        value={values.read ? 'read' : 'not-read'}
                                        options={[
                                            { value: 'not-read', label: t('status.notRead') },
                                            { value: 'read', label: t('status.read') },
                                        ]}
                                        onChange={(event) =>
                                            set('read', event.target.value === 'read')
                                        }
                                    />
                                )}
                            </div>
                            <CollectionField
                                values={values}
                                error={errorFor('collection')}
                                onChange={(changes) => update(changes)}
                            />
                        </div>
                        <CoverPicker
                            title={values.title}
                            savedCover={
                                book?.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null
                            }
                            choice={cover}
                            onChange={setCover}
                        />
                    </div>
                </Panel>
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
                <section className="panel">
                    <h2 className="book-form__toggle-heading">
                        <button
                            type="button"
                            className="book-form__toggle"
                            aria-expanded={expanded}
                            aria-controls={sectionId + '-additional'}
                            onClick={() => setExpanded(!expanded)}
                        >
                            <Icon name={expanded ? 'collapse' : 'expand'} />
                            {t('form.additional')}
                        </button>
                    </h2>
                    {!expanded && <p className="muted">{t('form.additionalHint')}</p>}
                    <div id={sectionId + '-additional'} className="form" hidden={!expanded}>
                        <div className="book-form__row book-form__row--two">
                            <TextField
                                label={t('form.publisher')}
                                maxLength={200}
                                error={errorFor('publisher')}
                                value={values.publisher}
                                onChange={(event) => set('publisher', event.target.value)}
                            />
                            <div className="book-form__row book-form__row--two">
                                <SelectField
                                    label={t('form.publicationMonth')}
                                    value={values.publicationMonth}
                                    options={[
                                        { value: '', label: t('form.monthNone') },
                                        ...Array.from({ length: 12 }, (_, index) => ({
                                            value: String(index + 1),
                                            label: BookFormat.monthName(index + 1, locale),
                                        })),
                                    ]}
                                    onChange={(event) =>
                                        set('publicationMonth', event.target.value)
                                    }
                                />
                                <TextField
                                    label={t('form.publicationYear')}
                                    inputMode="numeric"
                                    maxLength={4}
                                    error={errorFor('publication')}
                                    value={values.publicationYear}
                                    onChange={(event) => set('publicationYear', event.target.value)}
                                />
                            </div>
                        </div>
                        <TextAreaField
                            label={t('form.summary')}
                            maxLength={5000}
                            value={values.summary}
                            onChange={(event) => set('summary', event.target.value)}
                        />
                        {errorFor('summary') && (
                            <p className="field__error">{errorFor('summary')}</p>
                        )}
                        <div className="book-form__row book-form__row--two">
                            <TextField
                                label={t('form.pageCount')}
                                inputMode="numeric"
                                maxLength={6}
                                error={errorFor('pageCount')}
                                value={values.pageCount}
                                onChange={(event) => set('pageCount', event.target.value)}
                            />
                            <TextField
                                label={t('form.price')}
                                inputMode="decimal"
                                maxLength={12}
                                hint={t('form.priceHint')}
                                error={errorFor('price')}
                                value={values.price}
                                onChange={(event) => set('price', event.target.value)}
                            />
                        </div>
                        {personal && (
                            <div className="form">
                                <p className="eyebrow">{t('form.personal')}</p>
                                {values.note === null ? (
                                    <div className="actions">
                                        <Button icon="add" onClick={() => set('note', '')}>
                                            {t('details.noteAdd')}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <TextAreaField
                                            label={t('details.noteLabel')}
                                            maxLength={5000}
                                            value={values.note}
                                            onChange={(event) => set('note', event.target.value)}
                                        />
                                        {errorFor('note') && (
                                            <p className="field__error">{errorFor('note')}</p>
                                        )}
                                        <div className="actions">
                                            <Button
                                                variant="ghost"
                                                icon="delete"
                                                onClick={() => set('note', null)}
                                            >
                                                {t('form.noteRemove')}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </section>
                {failure && <Notice tone="error">{failure.text}</Notice>}
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
            <SimilarAuthorDialog
                similar={similar}
                onClose={() => setSimilar(null)}
                onUse={(author) => {
                    const next = BookDraft.resolveAuthor(values, similar!.name, author);

                    setSimilar(null);
                    setValues(next);
                    void save(next);
                }}
                onCreate={() => {
                    const next = BookDraft.resolveAuthor(values, similar!.name, 'distinct');

                    setSimilar(null);
                    setValues(next);
                    void save(next);
                }}
            />
            <PossibleDuplicateDialog
                duplicate={duplicate}
                onClose={() => setDuplicate(null)}
                onOpen={(bookId) => leave('/books/' + bookId)}
                onContinue={() => {
                    setDuplicate(null);
                    void save(values, { confirmDistinct: true });
                }}
            />
            <SimilarCollectionDialog
                similar={similarCollection}
                onClose={() => setSimilarCollection(null)}
                onUse={(name) => {
                    const next = { ...values, collectionName: name, collectionDistinct: false };

                    setSimilarCollection(null);
                    setValues(next);
                    void save(next);
                }}
                onCreate={() => {
                    const next = { ...values, collectionDistinct: true };

                    setSimilarCollection(null);
                    setValues(next);
                    void save(next);
                }}
            />
            <VolumeZeroDialog
                volumeZero={volumeZero}
                onClose={() => setVolumeZero(null)}
                onEnable={() => {
                    const next = { ...values, enableVolumeZero: true };

                    setVolumeZero(null);
                    setValues(next);
                    void save(next);
                }}
            />
            <CoverageConflictDialog
                conflict={coverage}
                creating={!book}
                purchased={{
                    title: values.title,
                    isbn: values.noIsbn ? null : values.isbn.trim() || null,
                    volumeFrom: Number(values.volumeFrom),
                    volumeTo: Number(values.omnibus ? values.volumeTo : values.volumeFrom),
                }}
                onClose={() => setCoverage(null)}
                onUpdatePlanned={(bookId) => {
                    setCoverage(null);
                    void save({ ...values, ownership: 'owned' }, {}, bookId);
                }}
                onReplace={(bookIds) => {
                    setCoverage(null);
                    void save(values, { replacePlanned: bookIds });
                }}
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
