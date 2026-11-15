import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { BookDto, BookOrganisationDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { ShelfSelect } from '../../shared/book-form/shelf-select';
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
                            shelfId={shelfId}
                            hint={t('location.chooseHint')}
                            onChange={(next) => {
                                setShelfId(next.shelfId);
                                save({ shelfId: next.shelfId });
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
