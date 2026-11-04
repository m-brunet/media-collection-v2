import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import { useI18n } from '../shared/i18n/i18n-context';
import { SessionProvider, useSession } from '../shared/session/session-context';
import { EmptyState, LoadingState } from '../shared/ui/states';
import { PasswordSetupPage } from './access/password-setup-page';
import { SetupPage } from './access/setup-page';
import { SignInPage } from './access/sign-in-page';
import { AccountPage } from './account/account-page';
import { AccountsPage } from './administration/accounts-page';
import { ServerSettingsPage } from './administration/server-settings-page';
import { AppShell } from './shell/app-shell';

function NotFoundPage() {
    const { t } = useI18n();

    return (
        <EmptyState
            title={t('notFound.title')}
            body={t('notFound.body')}
            action={<Link to="/account">{t('notFound.back')}</Link>}
        />
    );
}

function PermissionDeniedPage() {
    const { t } = useI18n();

    return (
        <EmptyState
            icon="administration"
            title={t('denied.title')}
            body={t('denied.body')}
            action={<Link to="/account">{t('denied.back')}</Link>}
        />
    );
}

// The server enforces every permission; this only explains why a page cannot be used.
function AdministratorOnly({ children }: { children: ReactNode }) {
    const { account } = useSession();

    return account?.role === 'admin' ? children : <PermissionDeniedPage />;
}

// Session gate: nothing of the library is shown before sign-in and temporary-password replacement.
function LibrisRoutes() {
    const { t } = useI18n();
    const { status, account } = useSession();

    if (status === 'loading') {
        return <LoadingState label={t('session.connecting')} />;
    }

    if (status === 'setup') {
        return <SetupPage />;
    }

    if (!account) {
        return <SignInPage />;
    }

    if (account.mustChangePassword) {
        return <PasswordSetupPage />;
    }

    return (
        <AppShell>
            <Routes>
                <Route path="/" element={<Navigate to="/account" replace />} />
                <Route path="/account" element={<AccountPage />} />
                <Route
                    path="/admin/accounts"
                    element={
                        <AdministratorOnly>
                            <AccountsPage />
                        </AdministratorOnly>
                    }
                />
                <Route
                    path="/admin/server"
                    element={
                        <AdministratorOnly>
                            <ServerSettingsPage />
                        </AdministratorOnly>
                    }
                />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AppShell>
    );
}

export function LibrisApp() {
    return (
        <BrowserRouter>
            <SessionProvider>
                <LibrisRoutes />
            </SessionProvider>
        </BrowserRouter>
    );
}
