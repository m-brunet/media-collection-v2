import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useI18n } from '../shared/i18n/i18n-context';
import { SessionProvider, useSession } from '../shared/session/session-context';
import { SignInForm } from '../shared/session/sign-in-form';
import { Brand } from '../shared/ui/brand';
import { Button } from '../shared/ui/button';
import { LanguageSwitch } from '../shared/ui/language-switch';
import { Notice } from '../shared/ui/notice';
import { LoadingState } from '../shared/ui/states';

function LeafLayout({ children }: { children: ReactNode }) {
    return (
        <div className="leaf">
            <header className="leaf__header">
                <Brand app="leaf" />
            </header>
            <main className="leaf__main">{children}</main>
            <footer className="leaf__footer">
                <LanguageSwitch />
            </footer>
        </div>
    );
}

function SignOutButton() {
    const { t } = useI18n();
    const { signOut } = useSession();

    return (
        <Button icon="sign-out" onClick={() => void signOut()}>
            {t('account.signOut')}
        </Button>
    );
}

// Mobile home. Collection shopping and scanning arrive in Task 7.
function HomePage() {
    const { t } = useI18n();

    return (
        <section className="leaf__section">
            <p className="eyebrow">{t('leaf.home.eyebrow')}</p>
            <h1 className="leaf__title">{t('leaf.home.title')}</h1>
            <p className="muted">{t('leaf.home.pending')}</p>
            <SignOutButton />
        </section>
    );
}

function LeafRoutes() {
    const { t } = useI18n();
    const { status, account } = useSession();

    if (status === 'loading') {
        return <LoadingState label={t('session.connecting')} />;
    }

    if (status === 'setup') {
        return (
            <section className="leaf__section">
                <h1 className="leaf__title">{t('setup.remoteTitle')}</h1>
                <Notice tone="warning">{t('setup.remoteBody')}</Notice>
            </section>
        );
    }

    if (!account) {
        return (
            <section className="leaf__section">
                <h1 className="leaf__title">{t('signIn.title')}</h1>
                <p className="muted">{t('leaf.signIn.intro')}</p>
                <SignInForm />
            </section>
        );
    }

    // Leaf is for Owners and the administrator; Guests use Libris on a computer.
    if (account.role === 'guest') {
        return (
            <section className="leaf__section">
                <h1 className="leaf__title">{t('leaf.guest.title')}</h1>
                <Notice tone="info">{t('leaf.guest.body')}</Notice>
                <SignOutButton />
            </section>
        );
    }

    if (account.mustChangePassword) {
        return (
            <section className="leaf__section">
                <h1 className="leaf__title">{t('leaf.password.title')}</h1>
                <Notice tone="warning">{t('leaf.password.body')}</Notice>
                <SignOutButton />
            </section>
        );
    }

    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export function LeafApp() {
    return (
        <BrowserRouter basename="/leaf">
            <SessionProvider>
                <LeafLayout>
                    <LeafRoutes />
                </LeafLayout>
            </SessionProvider>
        </BrowserRouter>
    );
}
