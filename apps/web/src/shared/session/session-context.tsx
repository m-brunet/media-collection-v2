import type { ReactNode } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { Account, SetupStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../api.util';
import { I18nProvider } from '../i18n/i18n-context';
import { LanguageResolver } from '../i18n/language-resolver.util';
import { LanguageStorage } from '../i18n/language-storage.util';
import type { Language } from '../i18n/translator.util';

type SessionStatus = 'loading' | 'setup' | 'signed-out' | 'signed-in';

interface SessionValue {
    status: SessionStatus;
    account: Account | null;
    language: Language;
    expired: boolean;
    setupAllowed: boolean;
    completeSetup(username: string, password: string): Promise<void>;
    signIn(username: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    update(account: Account): void;
    chooseLanguage(language: Language): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<Account | null>(null);
    const [status, setStatus] = useState<SessionStatus>('loading');
    const [expired, setExpired] = useState(false);
    const [setupAllowed, setSetupAllowed] = useState(false);
    const [stored, setStored] = useState<Language | null>(() => LanguageStorage.read());
    const signedIn = useRef(false);

    useEffect(() => {
        const end = () => {
            if (!signedIn.current) {
                return;
            }

            signedIn.current = false;
            setAccount(null);
            setStatus('signed-out');
            setExpired(true);
        };

        window.addEventListener('session-expired', end);
        void api
            .request<Account>('/auth/me', { passive: true })
            .then((current) => {
                signedIn.current = true;
                setAccount(current);
                setStatus('signed-in');
            })
            .catch(async () => {
                const setup = await api
                    .request<SetupStatus>('/setup', { passive: true })
                    .catch(() => ({ required: false, allowed: false }));

                setSetupAllowed(setup.allowed);
                setStatus(setup.required ? 'setup' : 'signed-out');
            });

        return () => window.removeEventListener('session-expired', end);
    }, []);

    const signIn = useCallback(async (username: string, password: string) => {
        const current = await api.request<Account>('/auth/login', {
            method: 'POST',
            body: { username, password },
        });

        signedIn.current = true;
        setAccount(current);
        setStatus('signed-in');
        setExpired(false);
    }, []);
    const completeSetup = useCallback(async (username: string, password: string) => {
        const current = await api.request<Account>('/setup', {
            method: 'POST',
            body: { username, password },
        });

        signedIn.current = true;
        setAccount(current);
        setStatus('signed-in');
    }, []);
    const signOut = useCallback(async () => {
        await api.request('/auth/logout', { method: 'POST' });
        signedIn.current = false;
        setAccount(null);
        setStatus('signed-out');
    }, []);
    const update = useCallback((current: Account) => setAccount(current), []);
    const chooseLanguage = useCallback(
        async (language: Language) => {
            LanguageStorage.write(language);
            setStored(language);

            if (account) {
                setAccount(
                    await api.request<Account>('/account/language', {
                        method: 'PATCH',
                        body: { language },
                    }),
                );
            }
        },
        [account],
    );
    const language = LanguageResolver.resolve(
        account?.language ?? null,
        stored,
        navigator.languages ?? [navigator.language],
    );
    const value = useMemo<SessionValue>(
        () => ({
            status,
            account,
            language,
            expired,
            setupAllowed,
            completeSetup,
            signIn,
            signOut,
            update,
            chooseLanguage,
        }),
        [
            status,
            account,
            language,
            expired,
            setupAllowed,
            completeSetup,
            signIn,
            signOut,
            update,
            chooseLanguage,
        ],
    );

    return (
        <SessionContext.Provider value={value}>
            <I18nProvider language={language}>{children}</I18nProvider>
        </SessionContext.Provider>
    );
}

export function useSession(): SessionValue {
    const value = useContext(SessionContext);

    if (!value) {
        throw new Error('useSession must be used inside SessionProvider.');
    }

    return value;
}
