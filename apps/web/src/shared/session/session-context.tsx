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
import { api, ApiError } from '../api.util';
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
    pairingExpired: boolean;
    setupAllowed: boolean;
    completeSetup(username: string, password: string): Promise<void>;
    signIn(username: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    update(account: Account): void;
    chooseLanguage(language: Language): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
    children,
    pairing = null,
}: {
    children: ReactNode;
    pairing?: string | null;
}) {
    const [account, setAccount] = useState<Account | null>(null);
    const [status, setStatus] = useState<SessionStatus>('loading');
    const [expired, setExpired] = useState(false);
    const [pairingExpired, setPairingExpired] = useState(false);
    const startup = useRef<Promise<Account> | null>(null);
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
        startup.current ??= pairing
            ? api
                  .request<Account>('/auth/pair', { method: 'POST', body: { code: pairing } })
                  .catch((error: unknown) => {
                      setPairingExpired(error instanceof ApiError && error.status === 401);

                      return api.request<Account>('/auth/me', { passive: true });
                  })
            : api.request<Account>('/auth/me', { passive: true });
        void startup.current
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
    }, [pairing]);

    const signIn = useCallback(async (username: string, password: string) => {
        const current = await api.request<Account>('/auth/login', {
            method: 'POST',
            body: { username, password },
        });

        signedIn.current = true;
        setAccount(current);
        setStatus('signed-in');
        setExpired(false);
        setPairingExpired(false);
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
            pairingExpired,
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
            pairingExpired,
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
