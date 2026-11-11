import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ReceiverLoansDto, ReturnDto } from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { LoanLinks } from './loan-links.util';

export function ReturnPage() {
    const { t, dates } = useI18n();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const receiverId = params.get('receiver') ?? '';
    const startLoan = params.get('loan');
    const [group, setGroup] = useState<ReceiverLoansDto | null | undefined>(undefined);
    const [checked, setChecked] = useState<Set<string>>(new Set(startLoan ? [startLoan] : []));
    const [failure, setFailure] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(
        () =>
            api
                .request<ReceiverLoansDto[]>('/loans?receiver=' + encodeURIComponent(receiverId))
                .then(
                    (groups) => {
                        const found = groups[0] ?? null;

                        setGroup(found);
                        setChecked(
                            (current) =>
                                new Set(
                                    (found?.loans ?? [])
                                        .filter((loan) => current.has(loan.loanId))
                                        .map((loan) => loan.loanId),
                                ),
                        );
                    },
                    (error: unknown) => {
                        if (error instanceof ApiError && error.status === 400) {
                            setGroup(null);
                        } else {
                            setFailure(t(ApiErrorMessage.key(error)));
                        }
                    },
                ),
        [receiverId, t],
    );

    useEffect(() => {
        void load();
    }, [load]);

    if (group === undefined) {
        return failure ? (
            <Notice tone="error">{failure}</Notice>
        ) : (
            <LoadingState label={t('common.loading')} />
        );
    }

    if (group === null) {
        return (
            <EmptyState
                icon="lend"
                title={t('return.missing')}
                action={<Link to={LoanLinks.list}>{t('return.back')}</Link>}
            />
        );
    }

    const name = group.receiver.name;
    const returning = group.loans.filter((loan) => checked.has(loan.loanId));
    const staying = group.loans.filter((loan) => !checked.has(loan.loanId));
    const toggle = (loanId: string) => {
        const next = new Set(checked);

        if (next.has(loanId)) {
            next.delete(loanId);
        } else {
            next.add(loanId);
        }

        setChecked(next);
    };
    const record = async () => {
        setBusy(true);
        setFailure(null);

        try {
            const result = await api.request<ReturnDto>('/loans/returns', {
                method: 'POST',
                body: { loanIds: returning.map((loan) => loan.loanId) },
            });

            navigate(LoanLinks.list, {
                state: {
                    done:
                        result.returned.length === 1
                            ? t('loans.returnedOne', { name: result.receiver.name })
                            : t('loans.returnedMany', {
                                  count: result.returned.length,
                                  name: result.receiver.name,
                              }),
                },
            });
        } catch (error) {
            if (
                error instanceof ApiError &&
                (error.reason === 'loan-already-returned' || error.reason === 'loan-missing')
            ) {
                setFailure(t('return.conflict'));
                await load();
            } else {
                setFailure(t(ApiErrorMessage.key(error)));
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <PageHeader
                title={t('return.title')}
                intro={
                    group.loans.length === 1
                        ? t('return.introOne', { name })
                        : t('return.introMany', { name, count: group.loans.length })
                }
            />
            <div className="lend-layout">
                <div className="stack">
                    {failure && <Notice tone="error">{failure}</Notice>}
                    <Panel label={t('return.select')}>
                        <div className="actions">
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    setChecked(new Set(group.loans.map((loan) => loan.loanId)))
                                }
                            >
                                {t('return.selectAll')}
                            </Button>
                            <Button variant="ghost" onClick={() => setChecked(new Set())}>
                                {t('return.clear')}
                            </Button>
                        </div>
                        <ul className="lend-list" aria-label={t('return.select')}>
                            {group.loans.map((loan) => {
                                const selected = checked.has(loan.loanId);
                                const state = [
                                    loan.loanId === startLoan ? t('return.starting') : null,
                                    t('loans.lentOn', { date: dates.date(loan.lentAt) }),
                                    selected ? t('return.selectedState') : t('return.staysLent'),
                                ]
                                    .filter(Boolean)
                                    .join(' · ');

                                return (
                                    <li key={loan.loanId} className="lend-row">
                                        <label className="checkbox return-row">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggle(loan.loanId)}
                                            />
                                            <span className="lend-row__book">
                                                <span className="lend-row__title">
                                                    {loan.book.title}
                                                </span>
                                                <span className="muted">{state}</span>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                </div>
                <aside className="lend-summary panel" aria-label={t('return.summary')}>
                    <p className="eyebrow">{t('return.summary')}</p>
                    <p className="lend-summary__count">
                        {t('return.summaryCount', {
                            selected: returning.length,
                            total: group.loans.length,
                        })}
                    </p>
                    <p>{t('return.from', { name })}</p>
                    <dl className="lend-summary__lists">
                        <dt>{t('return.returning')}</dt>
                        <dd>
                            {returning.length > 0
                                ? returning.map((loan) => loan.book.title).join(' · ')
                                : t('return.none')}
                        </dd>
                        <dt>{t('return.stillLent')}</dt>
                        <dd>
                            {staying.length > 0
                                ? staying.map((loan) => loan.book.title).join(' · ')
                                : t('return.none')}
                        </dd>
                    </dl>
                    <p className="muted">{t('return.note')}</p>
                    <div className="lend-summary__actions">
                        <Button
                            variant="primary"
                            icon="lend-return"
                            busy={busy}
                            disabled={returning.length === 0}
                            onClick={() => void record()}
                        >
                            {returning.length === 0
                                ? t('lend.confirmEmpty')
                                : returning.length === 1
                                  ? t('return.confirmOne')
                                  : t('return.confirmMany', { count: returning.length })}
                        </Button>
                        <Button variant="ghost" onClick={() => navigate(LoanLinks.list)}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </aside>
            </div>
        </>
    );
}
