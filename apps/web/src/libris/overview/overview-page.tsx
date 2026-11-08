import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { OverviewDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { BookCover } from '../books/book-cover';

type RecentBook = OverviewDto['recentlyAdded'][number];

function Counter({ value, label }: { value: string; label: string }) {
    return (
        <div className="overview-counter">
            <dt className="overview-counter__label">{label}</dt>
            <dd className="overview-counter__value">{value}</dd>
        </div>
    );
}

function RecentBookCard({ book }: { book: RecentBook }) {
    const { t } = useI18n();

    return (
        <li>
            <Link to={'/books/' + book.id} className="overview-book">
                <BookCover
                    src={book.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null}
                    title={book.title}
                />
                <span className="overview-book__title">{book.title}</span>
                {book.authors.length > 0 && (
                    <span className="muted">{book.authors.join(', ')}</span>
                )}
                {book.read !== null && (
                    <span className="overview-book__status">
                        {t('status.owned')} · {t(book.read ? 'status.read' : 'status.notRead')}
                    </span>
                )}
            </Link>
        </li>
    );
}

// Read and Not read shares of the viewer's owned books. The counts are written out beside it,
// so the bar itself is decorative.
function ReadingBar({ read, notRead }: { read: number; notRead: number }) {
    return (
        <div className="overview-reading__bar" aria-hidden="true">
            {read > 0 && <span className="overview-reading__read" style={{ flexGrow: read }} />}
            {(notRead > 0 || read === 0) && (
                <span className="overview-reading__not-read" style={{ flexGrow: notRead || 1 }} />
            )}
        </div>
    );
}

// The household library at a glance. Counts come from the server; the reading part is the
// viewer's own and absent for Guests.
export function OverviewPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const [overview, setOverview] = useState<OverviewDto | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const editor = account?.role !== 'guest';

    useEffect(() => {
        let current = true;

        api.request<OverviewDto>('/overview').then(
            (value) => current && setOverview(value),
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [attempt, t]);

    const retry = () => {
        setFailure(null);
        setAttempt((value) => value + 1);
    };
    const addBook = editor ? (
        <Button variant="primary" icon="add" onClick={() => navigate('/books/new')}>
            {t('overview.addBook')}
        </Button>
    ) : undefined;

    return (
        <>
            <PageHeader title={t('overview.title')} intro={t('overview.intro')} actions={addBook} />
            {failure ? (
                <Notice tone="error">
                    {failure} <Button onClick={retry}>{t('overview.retry')}</Button>
                </Notice>
            ) : !overview ? (
                <LoadingState label={t('overview.loading')} />
            ) : (
                <div className="overview">
                    <dl className="overview-counters">
                        <Counter value={String(overview.ownedBooks)} label={t('overview.owned')} />
                        <Counter
                            value={String(overview.collections)}
                            label={t('overview.collections')}
                        />
                        <Counter
                            value={overview.bookcases + ' / ' + overview.shelves}
                            label={t('overview.locations')}
                        />
                        <Counter value={String(overview.lentBooks)} label={t('overview.lent')} />
                    </dl>
                    <section className="overview-recent">
                        <div className="overview-recent__heading">
                            <h2 className="eyebrow">{t('overview.recent')}</h2>
                            <Link to="/books?sort=added-desc">{t('overview.allBooks')}</Link>
                        </div>
                        {overview.recentlyAdded.length === 0 ? (
                            <EmptyState
                                icon="books"
                                title={t('overview.emptyTitle')}
                                body={t(editor ? 'overview.emptyBody' : 'overview.emptyGuest')}
                            />
                        ) : (
                            <ul className="overview-books" aria-label={t('overview.recent')}>
                                {overview.recentlyAdded.map((book) => (
                                    <RecentBookCard key={book.id} book={book} />
                                ))}
                            </ul>
                        )}
                    </section>
                    <div className="overview-cards">
                        {overview.reading && (
                            <Panel className="overview-reading">
                                <h2 className="eyebrow">{t('overview.reading')}</h2>
                                <p className="overview-reading__counts">
                                    {t('overview.readingCounts', {
                                        read: overview.reading.read,
                                        notRead: overview.reading.notRead,
                                    })}
                                </p>
                                <ReadingBar
                                    read={overview.reading.read}
                                    notRead={overview.reading.notRead}
                                />
                                <p className="muted">{t('overview.readingNote')}</p>
                            </Panel>
                        )}
                        <Panel className="overview-locations">
                            <h2 className="eyebrow">{t('overview.bookcases')}</h2>
                            {overview.bookcaseList.length === 0 ? (
                                <p className="muted">{t('overview.noBookcases')}</p>
                            ) : (
                                <ul className="overview-bookcases">
                                    {overview.bookcaseList.map((bookcase, index) => (
                                        <li
                                            key={bookcase.id}
                                            className={
                                                index === 0
                                                    ? 'overview-bookcases__first'
                                                    : undefined
                                            }
                                        >
                                            {t(
                                                bookcase.shelfCount === 1
                                                    ? 'overview.bookcaseOne'
                                                    : 'overview.bookcaseMany',
                                                {
                                                    name: bookcase.name,
                                                    count: bookcase.shelfCount,
                                                },
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Link to="/bookshelves">{t('overview.manageLocations')}</Link>
                        </Panel>
                    </div>
                </div>
            )}
        </>
    );
}
