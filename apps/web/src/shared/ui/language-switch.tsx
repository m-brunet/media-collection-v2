import { useState } from 'react';
import { useI18n } from '../i18n/i18n-context';
import type { Language } from '../i18n/translator.util';
import { useSession } from '../session/session-context';

const languages: Language[] = ['en', 'fr'];

export function LanguageSwitch() {
    const { language, chooseLanguage } = useSession();
    const { t } = useI18n();
    const [failed, setFailed] = useState(false);

    return (
        <div className="language-switch">
            <div role="group" aria-label={t('language.label')} className="language-switch__group">
                {languages.map((option) => (
                    <button
                        key={option}
                        type="button"
                        lang={option}
                        aria-pressed={language === option}
                        className="language-switch__option"
                        onClick={() => {
                            setFailed(false);
                            void chooseLanguage(option).catch(() => setFailed(true));
                        }}
                    >
                        {t(option === 'en' ? 'language.en' : 'language.fr')}
                    </button>
                ))}
            </div>
            {failed && (
                <p role="alert" className="field__error">
                    {t('language.saveFailed')}
                </p>
            )}
        </div>
    );
}
