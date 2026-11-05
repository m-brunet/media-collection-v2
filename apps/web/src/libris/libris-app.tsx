import type { ReactNode } from 'react';
import { useState } from 'react';
import { createBrowserRouter, Link, Navigate, Route, RouterProvider, Routes } from 'react-router';
import { useI18n } from '../shared/i18n/i18n-context';
import { AppearanceProvider } from '../shared/appearance/appearance-context';
import { SessionProvider, useSession } from '../shared/session/session-context';
import { EmptyState, LoadingState } from '../shared/ui/states';
import { PasswordSetupPage } from './access/password-setup-page';
import { SetupPage } from './access/setup-page';
import { SignInPage } from './access/sign-in-page';
import { AccountPage } from './account/account-page';
import { AccountsPage } from './administration/accounts-page';
import { AppearancePage } from './administration/appearance-page';
import { ServerSettingsPage } from './administration/server-settings-page';
import { AppShell } from './shell/app-shell';
import { BookDetailsPage } from './books/book-details-page';
import { BookFormPage } from './books/book-form-page';
import { BookSavedPage } from './books/book-saved-page';
import { MyBooksPage } from './books/my-books-page';
import { CollectionDetailsPage } from './collections/collection-details-page';
import { CollectionsPage } from './collections/collections-page';

function NotFoundPage() {
    const { t } = useI18n();

    return (
        <EmptyState
            title={t('notFound.title')}
            body={t('notFound.body')}
            action={<Link to="/books">{t('notFound.back')}</Link>}
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
            action={<Link to="/books">{t('denied.back')}</Link>}
        />
    );
}

// The server enforces every permission; this only explains why a page cannot be used.
function AdministratorOnly({ children }: { children: ReactNode }) {
    const { account } = useSession();

    return account?.role === 'admin' ? children : <PermissionDeniedPage />;
}

// Guests read the library but cannot change it (the server refuses it too).
function LibraryEditorOnly({ children }: { children: ReactNode }) {
    const { account } = useSession();

    return account?.role === 'guest' ? <PermissionDeniedPage /> : children;
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
                <Route path="/" element={<Navigate to="/books" replace />} />
                <Route path="/books" element={<MyBooksPage />} />
                <Route
                    path="/books/new"
                    element={
                        <LibraryEditorOnly>
                            <BookFormPage />
                        </LibraryEditorOnly>
                    }
                />
                <Route path="/books/:id" element={<BookDetailsPage />} />
                <Route
                    path="/books/:id/edit"
                    element={
                        <LibraryEditorOnly>
                            <BookFormPage />
                        </LibraryEditorOnly>
                    }
                />
                <Route path="/books/:id/added" element={<BookSavedPage />} />
                <Route path="/collections" element={<CollectionsPage />} />
                <Route path="/collections/:id" element={<CollectionDetailsPage />} />
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
                    path="/admin/appearance"
                    element={
                        <AdministratorOnly>
                            <AppearancePage />
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

function LibrisRoot() {
    return (
        <AppearanceProvider>
            <SessionProvider>
                <LibrisRoutes />
            </SessionProvider>
        </AppearanceProvider>
    );
}

// A data router, so forms can ask before any navigation drops their unsaved changes.
export function LibrisApp() {
    const [router] = useState(() => createBrowserRouter([{ path: '*', element: <LibrisRoot /> }]));

    return <RouterProvider router={router} />;
}
