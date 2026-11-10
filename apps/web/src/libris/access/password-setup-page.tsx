import { useI18n } from '../../shared/i18n/i18n-context';
import { PasswordForm } from '../account/password-form';
import { AccessLayout } from './sign-in-page';

export function PasswordSetupPage() {
    const { t } = useI18n();

    return (
        <AccessLayout>
            <h1 className="access__title">{t('password.setupTitle')}</h1>
            <p className="muted">{t('password.setupIntro')}</p>
            <PasswordForm setup />
        </AccessLayout>
    );
}
