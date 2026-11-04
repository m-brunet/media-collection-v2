import type { FormEvent } from 'react';
import { useState } from 'react';
import type { ColorSchemeName } from '../../../../../packages/contracts/src/http';
import { useAppearance } from '../../shared/appearance/appearance-context';
import { ColorSchemeDocument } from '../../shared/appearance/color-scheme-document.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';

const names: Record<ColorSchemeName, MessageKey> = {
    'spring-green': 'appearance.scheme.springGreen',
    mint: 'appearance.scheme.mint',
    emerald: 'appearance.scheme.emerald',
    forest: 'appearance.scheme.forest',
};

// Installation-wide appearance, chosen by the administrator for everyone in Libris and Leaf.
export function AppearancePage() {
    const { t } = useI18n();
    const { colorScheme, saveColorScheme } = useAppearance();
    const [selected, setSelected] = useState<ColorSchemeName>(colorScheme);
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void action.run(() => saveColorScheme(selected), 'appearance.saved');
    };

    return (
        <>
            <PageHeader title={t('appearance.title')} intro={t('appearance.intro')} />
            <Panel title={t('appearance.colorScheme')}>
                <form className="form" onSubmit={submit} aria-label={t('appearance.colorScheme')}>
                    <fieldset className="scheme-choices">
                        <legend className="visually-hidden">{t('appearance.colorScheme')}</legend>
                        {ColorSchemeDocument.names.map((name) => (
                            <label key={name} className="scheme-choice" data-color-scheme={name}>
                                <input
                                    type="radio"
                                    name="colorScheme"
                                    value={name}
                                    checked={selected === name}
                                    onChange={() => setSelected(name)}
                                />
                                <span className="scheme-choice__swatches" aria-hidden="true">
                                    <span className="scheme-choice__swatch scheme-choice__swatch--accent" />
                                    <span className="scheme-choice__swatch scheme-choice__swatch--background" />
                                    <span className="scheme-choice__swatch scheme-choice__swatch--text" />
                                </span>
                                <span className="scheme-choice__name">
                                    {t(names[name])}
                                    {name === 'spring-green' && (
                                        <span className="field__hint">
                                            {' '}
                                            · {t('appearance.default')}
                                        </span>
                                    )}
                                </span>
                                <span className="scheme-choice__preview" aria-hidden="true">
                                    <span className="scheme-choice__button">
                                        {t('appearance.sample')}
                                    </span>
                                    <span className="scheme-choice__selected">
                                        {t('nav.accounts')}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <p className="field__hint">{t('appearance.hint')}</p>
                    {action.feedback && (
                        <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>
                    )}
                    <div className="actions">
                        <Button
                            type="submit"
                            variant="primary"
                            busy={action.busy}
                            disabled={selected === colorScheme}
                        >
                            {t('appearance.save')}
                        </Button>
                    </div>
                </form>
            </Panel>
        </>
    );
}
