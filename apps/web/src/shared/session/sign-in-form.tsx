import type { FormEvent } from 'react';
import { useI18n } from '../i18n/i18n-context';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';
import { TextField } from '../ui/text-field';
import { useAction } from '../use-action';
import { useSession } from './session-context';

export function SignInForm() {
    const { t } = useI18n();
    const { signIn, expired, pairingExpired } = useSession();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);

        void action.run(
            () => signIn(String(form.get('username')), String(form.get('password'))),
            undefined,
            { 401: 'signIn.failed', 400: 'signIn.failed' },
        );
    };

    return (
        <form className="form" onSubmit={submit} aria-label={t('signIn.title')}>
            {expired && !action.feedback && (
                <Notice tone="warning">{t('errors.unauthorized')}</Notice>
            )}
            {pairingExpired && !action.feedback && (
                <Notice tone="warning">{t('leaf.pairing.expired')}</Notice>
            )}
            <TextField
                label={t('signIn.username')}
                name="username"
                autoComplete="username"
                placeholder={t('signIn.usernamePlaceholder')}
                maxLength={40}
                required
            />
            <TextField
                label={t('signIn.password')}
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder={t('signIn.passwordPlaceholder')}
                maxLength={128}
                required
            />
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            <Button type="submit" variant="primary" busy={action.busy}>
                {t('signIn.submit')}
            </Button>
        </form>
    );
}
