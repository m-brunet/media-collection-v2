import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { ReceiverLoansDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { TextField } from '../../shared/ui/text-field';
import { BookCover } from '../books/book-cover';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { LoanLinks } from './loan-links.util';

export function LoansPage() {
    const { t, dates } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const done = (location.state as { done?: string } | null)?.done;
    const editor = account?.role !== 'guest';
    const [search, setSearch] = useState('');
    const [result, setResult] = useState<{ search: string; groups: ReceiverLoansDto[] } | null>(
        null,
    );
    const [failure, setFailure] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let current = true;
        const timer = setTimeout(
            () => {
                api.request<ReceiverLoansDto[]>(
                    '/loans?search=' + encodeURIComponent(search.trim()),
                ).then(
                    (groups) => {
                        if (current) {
                            setResult({ search: search.trim(), groups });
                            setFailure(null);
                        }
                    },
                    (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
                );
            },
            search ? 200 : 0,
        );

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [search, attempt, t]);

    const groups = result?.groups ?? [];
    const lentCount = groups.reduce((count, group) => count + group.loans.length, 0);
    const nothingLent = result !== null && result.search === '' && groups.length === 0;

    return (
        <>
            <PageHeader
                title={t('loans.title')}
                intro={
                    result && !nothingLent && result.search === ''
                        ? [
                              lentCount === 1
                                  ? t('loans.booksOne')
                                  : t('loans.booksMany', { count: lentCount }),
                              groups.length === 1
                                  ? t('loans.receiversOne')
                                  : t('loans.receiversMany', { count: groups.length }),
                          ].join(' · ')
                        : undefined
                }
            />
            <div className="stack">
                {done && <Notice tone="success">{done}</Notice>}
                {failure && (
                    <Notice tone="error">
                        {failure}{' '}
                        <Button variant="ghost" onClick={() => setAttempt(attempt + 1)}>
                            {t('loans.retry')}
                        </Button>
                    </Notice>
                )}
                {!result && !failure && <LoadingState label={t('loans.loading')} />}
                {nothingLent && (
                    <EmptyState
                        icon="lend"
                        title={t('loans.empty')}
                        body={t('loans.emptyBody')}
                        action={<Link to="/books">{t('loans.browse')}</Link>}
                    />
                )}
                {result && !nothingLent && (
                    <>
                        <TextField
                            label={t('loans.searchLabel')}
                            type="search"
                            placeholder={t('loans.searchPlaceholder')}
                            className="loans-page__search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {groups.length === 0 ? (
                            <EmptyState
                                icon="search"
                                title={t('loans.noResults', { search: result.search })}
                                body={t('loans.noResultsHint')}
                            />
                        ) : (
                            groups.map((group) => (
                                <section
                                    key={group.receiver.id}
                                    className="receiver-group"
                                    aria-labelledby={'receiver-' + group.receiver.id}
                                >
                                    <header className="receiver-group__header">
                                        <h2
                                            id={'receiver-' + group.receiver.id}
                                            className="receiver-group__name"
                                        >
                                            {group.receiver.name}
                                        </h2>
                                        <p className="eyebrow">
                                            {group.loans.length === 1
                                                ? t('loans.booksOne')
                                                : t('loans.booksMany', {
                                                      count: group.loans.length,
                                                  })}
                                        </p>
                                    </header>
                                    <ul className="loan-list">
                                        {group.loans.map((loan) => (
                                            <li key={loan.loanId} className="loan-row">
                                                <BookCover
                                                    src={
                                                        loan.book.hasCover
                                                            ? BookFormat.cover(
                                                                  loan.book.id,
                                                                  loan.book.updatedAt,
                                                              )
                                                            : null
                                                    }
                                                    title={loan.book.title}
                                                />
                                                <div className="loan-row__book">
                                                    <Link
                                                        to={'/books/' + loan.book.id}
                                                        className="loan-row__title"
                                                    >
                                                        {loan.book.title}
                                                    </Link>
                                                    <span className="muted">
                                                        {loan.book.authors.join(', ')}
                                                    </span>
                                                    <span className="loan-row__date">
                                                        {t('loans.lentOn', {
                                                            date: dates.date(loan.lentAt),
                                                        })}
                                                    </span>
                                                </div>
                                                <div className="loan-row__actions">
                                                    {editor && (
                                                        <Button
                                                            icon="lend-return"
                                                            aria-label={t(
                                                                'loans.recordReturnNamed',
                                                                { title: loan.book.title },
                                                            )}
                                                            onClick={() =>
                                                                navigate(
                                                                    LoanLinks.returns(
                                                                        group.receiver.id,
                                                                        loan.loanId,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            {t('loans.recordReturn')}
                                                        </Button>
                                                    )}
                                                    <Link to={'/books/' + loan.book.id}>
                                                        {t('loans.viewBook')} →
                                                    </Link>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))
                        )}
                    </>
                )}
            </div>
        </>
    );
}
