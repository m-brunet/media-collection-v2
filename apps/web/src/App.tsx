import { useEffect, useState } from 'react';
import type { Account } from '../../../packages/contracts/src/http';
import { api, ApiError } from './shared/api.util';
import { Credentials, Login } from './features/identity/Identity';
import { Users } from './features/identity/Users';
import { Notes } from './features/notes/Notes';
import { ServerSettings } from './features/server-settings/ServerSettings';

export function App() {
    const [account, setAccount] = useState<Account | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState('notes');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const expired = () => {
            setAccount(null);
            setMessage('Your session ended. Sign in again.');
        };

        window.addEventListener('session-expired', expired);
        void api
            .request<Account>('/auth/me', { passive: true })
            .then(setAccount)
            .catch((error) => {
                if (!(error instanceof ApiError && error.status === 401)) {
                    setMessage(error.message);
                }
            })
            .finally(() => setLoading(false));

        return () => window.removeEventListener('session-expired', expired);
    }, []);
    const signIn = (user: Account) => {
        setAccount(user);
        setMessage('');
        setPage('notes');
    };
    const logout = async () => {
        try {
            await api.request('/auth/logout', { method: 'POST' });
            setAccount(null);
            setMessage('');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Sign out failed.');
        }
    };

    return (
        <>
            <header>
                <strong>Electron Base</strong>
                {account && (
                    <span>
                        {account.username}
                        <button
                            className="secondary"
                            onClick={() => {
                                void logout();
                            }}
                        >
                            Sign out
                        </button>
                    </span>
                )}
            </header>
            <main>
                {message && (
                    <p role="status" className="notice">
                        {message}
                    </p>
                )}
                {loading ? (
                    <p>Connecting…</p>
                ) : !account ? (
                    <Login onLogin={signIn} />
                ) : account.mustChangePassword ? (
                    <Credentials account={account} onChange={setAccount} />
                ) : (
                    <>
                        <nav aria-label="Main navigation">
                            {[
                                'notes',
                                'account',
                                ...(account.role === 'admin' ? ['users', 'server'] : []),
                            ].map((item) => (
                                <button
                                    className={page === item ? 'selected' : 'secondary'}
                                    key={item}
                                    onClick={() => setPage(item)}
                                >
                                    {
                                        (
                                            {
                                                notes: 'Notes',
                                                account: 'Account',
                                                users: 'Accounts',
                                                server: 'Server settings',
                                            } as Record<string, string>
                                        )[item]
                                    }
                                </button>
                            ))}
                        </nav>
                        {page === 'notes' && <Notes />}
                        {page === 'account' && (
                            <Credentials account={account} onChange={setAccount} />
                        )}
                        {page === 'users' && <Users />}
                        {page === 'server' && <ServerSettings />}
                    </>
                )}
            </main>
        </>
    );
}
