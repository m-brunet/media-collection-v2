import { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { BookDto, PersonalNoteDto } from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { TextAreaField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { BookCover } from './book-cover';
import { BookBreadcrumb } from './book-breadcrumb';
import { CollectionFormat } from '../collections/collection-format.util';
import { BookFormat } from './book-format.util';
import { OrganisationEditor } from './organisation-editor';

function ReadingPanel({ book, onChange }: { book: BookDto; onChange(read: boolean): void }) {
    const { t } = useI18n();
    const action = useAction();
    const read = book.personal!.read;

    return (
        <Panel label={t('details.reading')}>
            <div className="actions">
                <Button
                    aria-pressed={read}
                    icon={read ? 'check' : undefined}
                    busy={action.busy}
                    className={read ? 'button--pressed' : undefined}
                    onClick={() =>
                        void action.run(async () => {
                            const result = await api.request<{ read: boolean }>(
                                '/books/' + book.id + '/reading',
                                { method: 'PUT', body: { read: !read } },
                            );

                            onChange(result.read);
                        })
                    }
                >
                    {t('details.readingToggle')}
                </Button>
                <span>{t('details.readingStatus', { status: t(BookFormat.reading(read)) })}</span>
            </div>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <p className="muted">{t('details.readingHint')}</p>
        </Panel>
    );
}

function NotePanel({
    book,
    onChange,
}: {
    book: BookDto;
    onChange(note: PersonalNoteDto | null): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const note = book.personal!.note;
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');

    return (
        <Panel label={t('details.note')} className="book-details__note">
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            {editing ? (
                <form
                    className="form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void action.run(async () => {
                            onChange(
                                await api.request<PersonalNoteDto>('/books/' + book.id + '/note', {
                                    method: 'PUT',
                                    body: { text },
                                }),
                            );
                            setEditing(false);
                        }, 'details.noteSaved');
                    }}
                >
                    <TextAreaField
                        label={t('details.noteLabel')}
                        value={text}
                        maxLength={5000}
                        required
                        autoFocus
                        onChange={(event) => setText(event.target.value)}
                    />
                    <div className="actions">
                        <Button type="submit" variant="primary" busy={action.busy}>
                            {t('details.noteSave')}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditing(false)}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </form>
            ) : note ? (
                <>
                    <p className="book-details__note-text">{note.text}</p>
                    <div className="actions">
                        <Button
                            icon="edit"
                            onClick={() => {
                                setText(note.text);
                                setEditing(true);
                                action.setFeedback(null);
                            }}
                        >
                            {t('details.noteEdit')}
                        </Button>
                        <Button
                            variant="danger"
                            icon="delete"
                            busy={action.busy}
                            onClick={() =>
                                void action.run(async () => {
                                    await api.request('/books/' + book.id + '/note', {
                                        method: 'DELETE',
                                    });
                                    onChange(null);
                                }, 'details.noteDeleted')
                            }
                        >
                            {t('details.noteDelete')}
                        </Button>
                    </div>
                </>
            ) : (
                <>
                    <p className="muted">{t('details.noteNone')}</p>
                    <div className="actions">
                        <Button
                            icon="add"
                            onClick={() => {
                                setText('');
                                setEditing(true);
                                action.setFeedback(null);
                            }}
                        >
                            {t('details.noteAdd')}
                        </Button>
                    </div>
                </>
            )}
        </Panel>
    );
}

function DeleteBookDialog({
    book,
    open,
    onClose,
}: {
    book: BookDto;
    open: boolean;
    onClose(): void;
}) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const action = useAction();

    return (
        <Dialog
            open={open}
            title={t('details.deleteTitle')}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button
                        variant="danger"
                        busy={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await api.request('/books/' + book.id, { method: 'DELETE' });
                                navigate('/books', { state: { deleted: book.title } });
                            })
                        }
                    >
                        {t('details.delete')}
                    </Button>
                </>
            }
        >
            <p>{t('details.deleteBody', { title: book.title })}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
        </Dialog>
    );
}

// One book: shared information for everyone, plus the viewer's own reading status and note.
export function BookDetailsPage() {
    const { id = '' } = useParams();

    return <BookDetails key={id} id={id} />;
}

function BookDetails({ id }: { id: string }) {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const followUpFailed = (location.state as { followUpFailed?: boolean } | null)?.followUpFailed;
    const { account } = useSession();
    const [book, setBook] = useState<BookDto | null>(null);
    const [missing, setMissing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const load = useAction();
    const { run } = load;
    const footnote = useId();
    const editor = account?.role !== 'guest';

    useEffect(() => {
        void run(async () => {
            try {
                setBook(await api.request<BookDto>('/books/' + id));
            } catch (error) {
                if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
                    setMissing(true);

                    return;
                }

                throw error;
            }
        });
    }, [id, run]);

    if (missing) {
        return (
            <EmptyState
                icon="books"
                title={t('details.missing')}
                body={t('details.missingBody')}
                action={<Link to="/books">{t('details.back')}</Link>}
            />
        );
    }

    if (!book) {
        return load.feedback ? (
            <Notice tone="error">{load.feedback.text}</Notice>
        ) : (
            <LoadingState label={t('common.loading')} />
        );
    }

    const volumes = book.collection
        ? CollectionFormat.volumes(book.collection.volumeFrom, book.collection.volumeTo)
        : null;
    const publication = [
        book.publisher,
        book.publicationYear === null
            ? null
            : BookFormat.publication(book.publicationYear, book.publicationMonth, locale),
    ].filter(Boolean);
    const extent = [
        book.pageCount === null ? null : t('details.pages', { count: book.pageCount }),
        book.priceCents === null ? null : BookFormat.price(book.priceCents, locale),
    ].filter(Boolean);

    return (
        <>
            <PageHeader
                title={t('details.title')}
                breadcrumb={<BookBreadcrumb title={book.title} />}
            />
            <div className="stack">
                {followUpFailed && <Notice tone="warning">{t('form.followUpFailed')}</Notice>}
                <div className="book-details">
                    <div className="book-details__cover">
                        <BookCover
                            src={book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null}
                            title={book.title}
                            size="large"
                        />
                        {editor && (
                            <Button
                                icon="edit"
                                onClick={() => navigate('/books/' + book.id + '/edit')}
                            >
                                {t('details.edit')}
                            </Button>
                        )}
                    </div>
                    <div className="book-details__info">
                        <p className="eyebrow">
                            {t(BookFormat.category(book.category))} ·{' '}
                            {t(BookFormat.ownership(book.ownership))}
                        </p>
                        <h2 className="book-details__title">{book.title}</h2>
                        <p className="book-details__authors">
                            {book.authors.map((author) => author.name).join(', ')}
                        </p>
                        {book.summary && <p className="book-details__summary">{book.summary}</p>}
                        <dl className="book-details__facts">
                            {book.collection && volumes && (
                                <div>
                                    <dt>{t('details.collection')}</dt>
                                    <dd>
                                        <Link to={'/collections/' + book.collection.id}>
                                            {t('books.collection', {
                                                name: book.collection.name,
                                                volumes: t(volumes.key, volumes.values),
                                            })}
                                        </Link>
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt>{t('details.publication')}</dt>
                                <dd>
                                    {publication.length > 0
                                        ? publication.join(' · ')
                                        : t('details.unknown')}
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    {t('details.isbn')}
                                    {book.isbnConvertedFromIsbn10 && (
                                        <sup className="book-details__isbn-mark">
                                            <Icon
                                                name="info"
                                                size={12}
                                                label={t('details.isbnConvertedLabel')}
                                            />
                                        </sup>
                                    )}
                                </dt>
                                <dd
                                    aria-describedby={
                                        book.isbnConvertedFromIsbn10 ? footnote : undefined
                                    }
                                >
                                    {book.isbn ?? t('details.noIsbn')}
                                </dd>
                            </div>
                        </dl>
                        {book.isbnConvertedFromIsbn10 && (
                            <p id={footnote} className="muted book-details__footnote">
                                <Icon name="info" size={12} /> {t('details.isbnConverted')}
                            </p>
                        )}
                        {extent.length > 0 && <p className="muted">{extent.join(' · ')}</p>}
                    </div>
                </div>
                <OrganisationEditor book={book} editor={editor} onSaved={setBook} />
                {book.personal && (
                    <div className="book-details__personal">
                        <ReadingPanel
                            book={book}
                            onChange={(read) =>
                                setBook({ ...book, personal: { ...book.personal!, read } })
                            }
                        />
                        <NotePanel
                            book={book}
                            onChange={(note) =>
                                setBook({ ...book, personal: { ...book.personal!, note } })
                            }
                        />
                    </div>
                )}
                {editor && (
                    <div className="actions">
                        <Button variant="danger" icon="delete" onClick={() => setDeleting(true)}>
                            {t('details.delete')}
                        </Button>
                    </div>
                )}
            </div>
            <DeleteBookDialog book={book} open={deleting} onClose={() => setDeleting(false)} />
        </>
    );
}
