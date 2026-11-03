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
import type { Account } from '../../../../../packages/contracts/src/http';
import { api } from '../api.util';
import { I18nProvider } from '../i18n/i18n-context';
import { LanguageResolver } from '../i18n/language-resolver.util';
import { LanguageStorage } from '../i18n/language-storage.util';
import type { Language } from '../i18n/translator.util';

type SessionStatus = 'loading' | 'signed-out' | 'signed-in';

interface SessionValue {
    status: SessionStatus;
    account: Account | null;
    language: Language;
    // True after the server ended the session (expiry, sign-out elsewhere).
    expired: boolean;
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
    const [stored, setStored] = useState<Language | null>(() => LanguageStorage.read());
    // Only a session that actually existed can expire; a first visit is simply signed out.
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
            .catch(() => setStatus('signed-out'));

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
        () => ({ status, account, language, expired, signIn, signOut, update, chooseLanguage }),
        [status, account, language, expired, signIn, signOut, update, chooseLanguage],
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
