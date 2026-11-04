import { useEffect, useState } from 'react';
import type { AccountSummary } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { RoleLabel } from '../../shared/role-label.util';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { useAction } from '../../shared/use-action';
import type { Feedback } from '../../shared/use-action';
import { AccountStatusDialog } from './account-status-dialog';
import { CreateAccountDialog } from './create-account-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';

// User management (administrator only): accounts with fixed roles, created with a temporary
// password, and deactivated rather than deleted.
export function AccountsPage() {
    const { t } = useI18n();
    const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
    const [creating, setCreating] = useState(false);
    const [resetting, setResetting] = useState<AccountSummary | null>(null);
    const [changing, setChanging] = useState<AccountSummary | null>(null);
    const [result, setResult] = useState<Feedback | null>(null);
    const load = useAction();
    const { run } = load;
    const administrator = accounts?.find((account) => account.role === 'admin');
    const others = accounts?.filter((account) => account.role !== 'admin') ?? [];
    const replace = (updated: AccountSummary) =>
        setAccounts((current) =>
            (current ?? []).map((account) => (account.id === updated.id ? updated : account)),
        );

    useEffect(() => {
        void run(async () => setAccounts(await api.request<AccountSummary[]>('/users')));
    }, [run]);

    return (
        <>
            <PageHeader
                title={t('accounts.title')}
                intro={t('accounts.intro')}
                actions={
                    <Button
                        variant="primary"
                        onClick={() => {
                            setResult(null);
                            setCreating(true);
                        }}
                    >
                        {t('accounts.createTitle')}
                    </Button>
                }
            />
            <div className="stack">
                {result && <Notice tone={result.tone}>{result.text}</Notice>}
                {load.feedback && <Notice tone="error">{load.feedback.text}</Notice>}
                {!accounts && !load.feedback && <LoadingState label={t('common.loading')} />}
                {administrator && (
                    <Panel label={t('accounts.protected')}>
                        <p className="panel__title">
                            {administrator.username} · {t('role.admin')} · {t('accounts.ready')}
                        </p>
                        <p className="muted">{t('accounts.protectedHint')}</p>
                    </Panel>
                )}
                {accounts && (
                    <Panel label={t('accounts.others')}>
                        {others.length === 0 ? (
                            <EmptyState icon="accounts" title={t('accounts.empty')} />
                        ) : (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">{t('accounts.username')}</th>
                                        <th scope="col">{t('accounts.role')}</th>
                                        <th scope="col">{t('accounts.status')}</th>
                                        <th scope="col">{t('accounts.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {others.map((account) => (
                                        <tr key={account.id}>
                                            <td>{account.username}</td>
                                            <td>{t(RoleLabel.name(account.role))}</td>
                                            <td>
                                                <span className="tag">
                                                    {t(
                                                        !account.active
                                                            ? 'accounts.deactivated'
                                                            : account.mustChangePassword
                                                              ? 'accounts.mustChange'
                                                              : 'accounts.ready',
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="actions">
                                                    {account.active && (
                                                        <Button
                                                            onClick={() => {
                                                                setResult(null);
                                                                setResetting(account);
                                                            }}
                                                            aria-label={
                                                                t('accounts.resetPassword') +
                                                                ' · ' +
                                                                account.username
                                                            }
                                                        >
                                                            {t('accounts.resetPassword')}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant={
                                                            account.active ? 'ghost' : 'secondary'
                                                        }
                                                        onClick={() => {
                                                            setResult(null);
                                                            setChanging(account);
                                                        }}
                                                        aria-label={
                                                            t(
                                                                account.active
                                                                    ? 'accounts.deactivate'
                                                                    : 'accounts.reactivate',
                                                            ) +
                                                            ' · ' +
                                                            account.username
                                                        }
                                                    >
                                                        {t(
                                                            account.active
                                                                ? 'accounts.deactivate'
                                                                : 'accounts.reactivate',
                                                        )}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <p className="field__hint">{t('accounts.lifecycleHint')}</p>
                    </Panel>
                )}
            </div>
            <CreateAccountDialog
                open={creating}
                onClose={() => setCreating(false)}
                onCreated={(account) => {
                    setAccounts((current) => [...(current ?? []), account]);
                    setCreating(false);
                    setResult({ tone: 'success', text: t('accounts.created') });
                }}
            />
            <ResetPasswordDialog
                account={resetting}
                onClose={() => setResetting(null)}
                onReset={(account) => {
                    replace(account);
                    setResetting(null);
                    setResult({
                        tone: 'success',
                        text: t('accounts.resetDone', { username: account.username }),
                    });
                }}
            />
            <AccountStatusDialog
                account={changing}
                onClose={() => setChanging(null)}
                onChanged={(account) => {
                    replace(account);
                    setChanging(null);
                    setResult({
                        tone: 'success',
                        text: t(
                            account.active
                                ? 'accounts.reactivatedDone'
                                : 'accounts.deactivatedDone',
                            { username: account.username },
                        ),
                    });
                }}
            />
        </>
    );
}
