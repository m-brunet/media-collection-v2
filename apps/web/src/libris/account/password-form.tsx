import type { FormEvent } from 'react';
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

export function PasswordForm({ setup = false }: { setup?: boolean }) {
    const { t } = useI18n();
    const { update } = useSession();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        if (form.get('password') !== form.get('confirmation')) {
            action.fail('password.mismatch');

            return;
        }

        void action.run(
            async () => {
                update(
                    await api.request<Account>('/account/password', {
                        method: 'PATCH',
                        body: {
                            currentPassword: form.get('currentPassword'),
                            password: form.get('password'),
                        },
                    }),
                );
                element.reset();
            },
            setup ? undefined : 'password.changed',
            { 400: 'password.incorrect' },
        );
    };

    return (
        <form className="form" onSubmit={submit} aria-label={t('password.sectionTitle')}>
            <TextField
                label={t('password.current')}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
            />
            <TextField
                label={t('password.new')}
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={t('password.newPlaceholder')}
                hint={t('password.rules')}
                minLength={8}
                maxLength={128}
                required
            />
            <TextField
                label={t('password.confirm')}
                name="confirmation"
                type="password"
                autoComplete="new-password"
                placeholder={t('password.confirmPlaceholder')}
                maxLength={128}
                required
            />
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" variant="primary" busy={action.busy}>
                    {t(setup ? 'password.setupSubmit' : 'password.submit')}
                </Button>
            </div>
        </form>
    );
}
