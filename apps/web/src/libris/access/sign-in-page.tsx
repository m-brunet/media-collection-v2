import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SignInForm } from '../../shared/session/sign-in-form';
import { Brand } from '../../shared/ui/brand';
import { LanguageSwitch } from '../../shared/ui/language-switch';

// Two-column access layout from the design: library introduction on the left, form on the right.
export function AccessLayout({ children }: { children: ReactNode }) {
    const { t } = useI18n();

    return (
        <div className="access">
            <section className="access__intro">
                <Brand app="libris" size="large" />
                <div className="access__pitch">
                    <p className="eyebrow">{t('signIn.eyebrow')}</p>
                    <p className="access__tagline">{t('signIn.tagline')}</p>
                    <p className="muted">{t('signIn.intro')}</p>
                </div>
            </section>
            <main className="access__main">
                <div className="access__card">{children}</div>
                <LanguageSwitch />
            </main>
        </div>
    );
}

export function SignInPage() {
    const { t } = useI18n();

    return (
        <AccessLayout>
            <h1 className="access__title">{t('signIn.title')}</h1>
            <p className="muted">{t('signIn.welcome')}</p>
            <SignInForm />
            <p className="field__hint">{t('signIn.accountsByAdmin')}</p>
            <p className="field__hint">
                <Link to="/credits">{t('nav.credits')}</Link>
            </p>
        </AccessLayout>
    );
}
