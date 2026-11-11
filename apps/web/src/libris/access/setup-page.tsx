import type { FormEvent } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { AccessLayout } from './sign-in-page';

export function SetupPage() {
    const { t } = useI18n();
    const { setupAllowed, completeSetup } = useSession();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        if (form.get('password') !== form.get('confirmation')) {
            action.fail('password.mismatch');

            return;
        }

        void action.run(() =>
            completeSetup(String(form.get('username')), String(form.get('password'))),
        );
    };

    if (!setupAllowed) {
        return (
            <AccessLayout>
                <h1 className="access__title">{t('setup.remoteTitle')}</h1>
                <Notice tone="warning">{t('setup.remoteBody')}</Notice>
            </AccessLayout>
        );
    }

    return (
        <AccessLayout>
            <h1 className="access__title">{t('setup.title')}</h1>
            <p className="muted">{t('setup.intro')}</p>
            <form className="form" onSubmit={submit} aria-label={t('setup.title')}>
                <TextField
                    label={t('setup.username')}
                    name="username"
                    autoComplete="username"
                    placeholder={t('setup.usernamePlaceholder')}
                    hint={t('account.usernameRules')}
                    minLength={3}
                    maxLength={40}
                    required
                />
                <TextField
                    label={t('setup.password')}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('setup.passwordPlaceholder')}
                    hint={t('password.rules')}
                    minLength={8}
                    maxLength={128}
                    required
                />
                <TextField
                    label={t('setup.confirm')}
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('setup.confirmPlaceholder')}
                    maxLength={128}
                    required
                />
                {action.feedback && (
                    <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>
                )}
                <Button type="submit" variant="primary" busy={action.busy}>
                    {t('setup.submit')}
                </Button>
            </form>
        </AccessLayout>
    );
}
