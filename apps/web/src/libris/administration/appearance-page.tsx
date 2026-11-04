import { useState } from 'react';
import type { ColorSchemeName } from '../../../../../packages/contracts/src/http';
import { useAppearance } from '../../shared/appearance/appearance-context';
import { ColorSchemeDocument } from '../../shared/appearance/color-scheme-document.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
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
    // Choosing a scheme saves it immediately; a failed save restores the previous choice.
    const choose = (name: ColorSchemeName) => {
        const previous = selected;

        setSelected(name);
        void action.run(async () => {
            try {
                await saveColorScheme(name);
            } catch (error) {
                setSelected(previous);
                throw error;
            }
        }, 'appearance.saved');
    };

    return (
        <>
            <PageHeader title={t('appearance.title')} intro={t('appearance.intro')} />
            <Panel title={t('appearance.colorScheme')}>
                <div className="form">
                    <fieldset className="scheme-choices" disabled={action.busy}>
                        <legend className="visually-hidden">{t('appearance.colorScheme')}</legend>
                        {ColorSchemeDocument.names.map((name) => (
                            <label key={name} className="scheme-choice" data-color-scheme={name}>
                                <input
                                    type="radio"
                                    name="colorScheme"
                                    value={name}
                                    checked={selected === name}
                                    onChange={() => choose(name)}
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
                </div>
            </Panel>
        </>
    );
}
