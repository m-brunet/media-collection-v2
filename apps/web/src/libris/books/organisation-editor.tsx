import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import type {
    BookDto,
    BookOrganisationDto,
    BookcaseDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import { Panel } from '../../shared/ui/layout';
import { LocationFormat } from '../locations/location-format.util';
import { useBookcases } from '../locations/use-bookcases';
import type { DraftTag } from '../../shared/book-form/book-draft.util';
import { TagPicker } from './tag-picker';

type Status =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved' }
    | { kind: 'failed'; text: string };

// Where the book is kept and its tags, as read by everyone.
function OrganisationSummary({ book }: { book: BookDto }) {
    const { t } = useI18n();

    return (
        <dl className="book-details__facts">
            <div>
                <dt>{t('location.label')}</dt>
                <dd>{book.location ? LocationFormat.label(book.location) : t('location.none')}</dd>
            </div>
            <div>
                <dt>{t('tags.field')}</dt>
                <dd>
                    {book.tags.length > 0 ? (
                        <ul className="tag-chips">
                            {book.tags.map((tag) => (
                                <li key={tag.id} className="chip chip--tag">
                                    {tag.name}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        t('tags.none')
                    )}
                </dd>
            </div>
        </dl>
    );
}

// The shelf choice of the inline editor: every shelf, grouped by bookcase.
function ShelfSelect({
    bookcases,
    value,
    onChange,
}: {
    bookcases: BookcaseDto[];
    value: string | null;
    onChange(shelfId: string | null): void;
}) {
    const { t } = useI18n();
    const id = useId();

    return (
        <div className="field">
            <label htmlFor={id} className="field__label">
                {t('location.label')}
            </label>
            <select
                id={id}
                className="field__control field__control--select"
                aria-describedby={id + '-hint'}
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value || null)}
            >
                <option value="">{t('location.unassigned')}</option>
                {bookcases.map((bookcase) => (
                    <optgroup key={bookcase.id} label={bookcase.name}>
                        {bookcase.shelves.map((shelf) => (
                            <option key={shelf.id} value={shelf.id}>
                                {LocationFormat.label({
                                    bookcaseName: bookcase.name,
                                    shelfName: shelf.name,
                                })}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <p id={id + '-hint'} className="field__hint">
                {t('location.chooseHint')}
            </p>
        </div>
    );
}

// Location and tags of a book, edited in place by Owners/Admin: each change is saved at once,
// without a Save button; Guests read them.
export function OrganisationEditor({
    book,
    editor,
    onSaved,
}: {
    book: BookDto;
    editor: boolean;
    onSaved(book: BookDto): void;
}) {
    const { t } = useI18n();
    const { bookcases } = useBookcases();
    const [shelfId, setShelfId] = useState(book.location?.shelfId ?? null);
    const [tags, setTags] = useState<DraftTag[]>(book.tags);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    // Changes are saved one after the other; only the latest answer updates the page. A refused
    // change returns to the last state the server confirmed, which may be newer than `book`.
    const queue = useRef(Promise.resolve());
    const latest = useRef(0);
    const confirmed = useRef(book);
    const save = (changes: BookOrganisationDto) => {
        const attempt = ++latest.current;

        setStatus({ kind: 'saving' });
        queue.current = queue.current.then(async () => {
            try {
                const saved = await api.request<BookDto>('/books/' + book.id + '/organisation', {
                    method: 'PATCH',
                    body: changes,
                });

                confirmed.current = saved;

                if (attempt === latest.current) {
                    setShelfId(saved.location?.shelfId ?? null);
                    setTags(saved.tags);
                    setStatus({ kind: 'saved' });
                    onSaved(saved);
                }
            } catch (error) {
                if (attempt === latest.current) {
                    const current = confirmed.current;

                    setShelfId(current.location?.shelfId ?? null);
                    setTags(current.tags);
                    setStatus({ kind: 'failed', text: t(ApiErrorMessage.key(error)) });

                    if (current !== book) {
                        onSaved(current);
                    }
                }
            }
        });
    };

    return (
        <Panel label={t('organisation.title')}>
            {!editor && <OrganisationSummary book={book} />}
            {editor && (
                <div className="form">
                    {bookcases && bookcases.some((bookcase) => bookcase.shelves.length > 0) ? (
                        <ShelfSelect
                            bookcases={bookcases}
                            value={shelfId}
                            onChange={(next) => {
                                setShelfId(next);
                                save({ shelfId: next });
                            }}
                        />
                    ) : (
                        bookcases && (
                            <p className="muted">
                                {t('location.noneYet')}{' '}
                                <Link to="/bookshelves">{t('location.manage')}</Link>
                            </p>
                        )
                    )}
                    <TagPicker
                        tags={tags}
                        hint={t('organisation.tagsHint')}
                        onChange={(next) => {
                            setTags(next);
                            save({
                                tags: next.map((tag) =>
                                    tag.id ? { id: tag.id } : { name: tag.name },
                                ),
                            });
                        }}
                    />
                    <p
                        className={
                            'organisation-status' +
                            (status.kind === 'failed' ? ' organisation-status--failed' : '')
                        }
                        role="status"
                    >
                        {status.kind === 'saving' && t('organisation.saving')}
                        {status.kind === 'saved' && (
                            <>
                                <Icon name="success" size={14} /> {t('organisation.saved')}
                            </>
                        )}
                        {status.kind === 'failed' && (
                            <>
                                <Icon name="error" size={14} /> {status.text}
                            </>
                        )}
                    </p>
                </div>
            )}
        </Panel>
    );
}
