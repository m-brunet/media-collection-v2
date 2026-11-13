import type { ReactNode } from 'react';
import { useState } from 'react';
import { createBrowserRouter, Navigate, Route, RouterProvider, Routes } from 'react-router';
import { useI18n } from '../shared/i18n/i18n-context';
import { AppearanceProvider } from '../shared/appearance/appearance-context';
import { SessionProvider, useSession } from '../shared/session/session-context';
import { SignInForm } from '../shared/session/sign-in-form';
import { Brand } from '../shared/ui/brand';
import { Button } from '../shared/ui/button';
import { LanguageSwitch } from '../shared/ui/language-switch';
import { Notice } from '../shared/ui/notice';
import { RoleLabel } from '../shared/role-label.util';
import { LoadingState } from '../shared/ui/states';
import { AddBookPage } from './books/add-book-page';
import { SavedPage } from './books/saved-page';
import { ScannedPage } from './books/scanned-page';
import { HomePage } from './home-page';
import { ScanPage } from './scan/scan-page';
import { CollectionShoppingPage } from './shopping/collection-shopping-page';
import { ShoppingListPage } from './shopping/shopping-list-page';

function LeafLayout({ children }: { children: ReactNode }) {
    return (
        <div className="leaf">
            <header className="leaf__header">
                <Brand app="leaf" />
            </header>
            <main className="leaf__main">{children}</main>
            <footer className="leaf__footer">
                <SignedInAs />
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

function SignedInAs() {
    const { t } = useI18n();
    const { account } = useSession();

    if (!account || account.role === 'guest' || account.mustChangePassword) {
        return null;
    }

    return (
        <div className="leaf__account">
            <span className="muted">
                {account.username} · {t(RoleLabel.name(account.role))}
            </span>
            <SignOutButton />
        </div>
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
            <Route path="/collections" element={<ShoppingListPage />} />
            <Route path="/collections/:id" element={<CollectionShoppingPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/scan/found" element={<ScannedPage />} />
            <Route path="/add" element={<AddBookPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function LeafRoot({ pairing }: { pairing: string | null }) {
    return (
        <AppearanceProvider>
            <SessionProvider pairing={pairing}>
                <LeafLayout>
                    <LeafRoutes />
                </LeafLayout>
            </SessionProvider>
        </AppearanceProvider>
    );
}

// A data router, so the book form can ask before discarding unsaved changes.
export function LeafApp({ pairing = null }: { pairing?: string | null }) {
    const [router] = useState(() =>
        createBrowserRouter([{ path: '*', element: <LeafRoot pairing={pairing} /> }], {
            basename: '/leaf',
        }),
    );

    return <RouterProvider router={router} />;
}
