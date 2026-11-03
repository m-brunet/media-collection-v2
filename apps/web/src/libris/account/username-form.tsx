import type { FormEvent } from 'react';
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

export function UsernameForm({ account }: { account: Account }) {
    const { t } = useI18n();
    const { update } = useSession();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        void action.run(
            async () => {
                update(
                    await api.request<Account>('/account/username', {
                        method: 'PATCH',
                        body: {
                            username: form.get('username'),
                            currentPassword: form.get('currentPassword'),
                        },
                    }),
                );
                (element.elements.namedItem('currentPassword') as HTMLInputElement).value = '';
            },
            'account.usernameChanged',
            { 409: 'account.usernameTaken', 400: 'password.incorrect' },
        );
    };

    return (
        <form className="form" onSubmit={submit} aria-label={t('account.usernameSubmit')}>
            <TextField
                label={t('account.username')}
                name="username"
                defaultValue={account.username}
                autoComplete="username"
                hint={t('account.usernameRules')}
                minLength={3}
                maxLength={40}
                pattern="\s*[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}\s*"
                required
            />
            <TextField
                label={t('password.current')}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
            />
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" busy={action.busy}>
                    {t('account.usernameSubmit')}
                </Button>
            </div>
        </form>
    );
}
