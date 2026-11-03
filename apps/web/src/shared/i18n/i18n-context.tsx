import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { en } from './catalog-en';
import type { MessageKey } from './catalog-en';
import { fr } from './catalog-fr';
import { DateTimeFormatter } from './date-time-formatter.util';
import type { Language, MessageValues } from './translator.util';
import { Translator } from './translator.util';

interface I18nValue {
    language: Language;
    t(key: MessageKey, values?: MessageValues): string;
    dates: DateTimeFormatter;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
    const value = useMemo<I18nValue>(() => {
        const translator = new Translator(language, language === 'fr' ? fr : en);

        return {
            language,
            t: (key, values) => translator.translate(key, values),
            dates: new DateTimeFormatter(translator.locale),
        };
    }, [language]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
    const value = useContext(I18nContext);

    if (!value) {
        throw new Error('useI18n must be used inside I18nProvider.');
    }

    return value;
}
