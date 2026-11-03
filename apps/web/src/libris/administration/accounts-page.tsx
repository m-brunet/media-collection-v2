import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { SelectField } from '../../shared/ui/select-field';
import { LoadingState } from '../../shared/ui/states';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

// Administrator account list and creation. Task 1 replaces the role model and adds lifecycle
// actions; this screen keeps the foundation's current behaviour in the new interface.
export function AccountsPage() {
    const { t } = useI18n();
    const [users, setUsers] = useState<Account[] | null>(null);
    const load = useAction();
    const create = useAction();
    const { run } = load;

    useEffect(() => {
        void run(async () => setUsers(await api.request<Account[]>('/users')));
    }, [run]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        void create.run(
            async () => {
                const user = await api.request<Account>('/users', {
                    method: 'POST',
                    body: {
                        username: form.get('username'),
                        password: form.get('password'),
                        role: form.get('role'),
                    },
                });

                setUsers((previous) => [...(previous ?? []), user]);
                element.reset();
            },
            'accounts.created',
            { 409: 'account.usernameTaken' },
        );
    };

    return (
        <>
            <PageHeader title={t('accounts.title')} intro={t('accounts.intro')} />
            <div className="panel-grid">
                <Panel>
                    {load.feedback && <Notice tone="error">{load.feedback.text}</Notice>}
                    {!users && !load.feedback && <LoadingState label={t('common.loading')} />}
                    {users && (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">{t('accounts.username')}</th>
                                    <th scope="col">{t('accounts.role')}</th>
                                    <th scope="col">{t('accounts.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.username}</td>
                                        <td>
                                            {t(user.role === 'admin' ? 'role.admin' : 'role.user')}
                                        </td>
                                        <td>
                                            <span className="tag">
                                                {t(
                                                    user.mustChangePassword
                                                        ? 'accounts.mustChange'
                                                        : 'accounts.ready',
                                                )}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
                <Panel title={t('accounts.createTitle')}>
                    <form className="form" onSubmit={submit} aria-label={t('accounts.createTitle')}>
                        <TextField
                            label={t('accounts.username')}
                            name="username"
                            autoComplete="off"
                            hint={t('account.usernameRules')}
                            minLength={3}
                            maxLength={40}
                            required
                        />
                        <TextField
                            label={t('accounts.temporaryPassword')}
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            hint={t('accounts.temporaryHint')}
                            minLength={8}
                            maxLength={128}
                            required
                        />
                        <SelectField
                            label={t('accounts.role')}
                            name="role"
                            options={[
                                { value: 'user', label: t('role.user') },
                                { value: 'admin', label: t('role.admin') },
                            ]}
                        />
                        {create.feedback && (
                            <Notice tone={create.feedback.tone}>{create.feedback.text}</Notice>
                        )}
                        <div className="actions">
                            <Button type="submit" variant="primary" busy={create.busy}>
                                {t('accounts.create')}
                            </Button>
                        </div>
                    </form>
                </Panel>
            </div>
        </>
    );
}
