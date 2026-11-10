import { useState } from 'react';
import type { ColorSchemeName, IconSetName } from '../../../../../packages/contracts/src/http';
import { useAppearance } from '../../shared/appearance/appearance-context';
import { ColorSchemeDocument } from '../../shared/appearance/color-scheme-document.util';
import { IconSetMemory } from '../../shared/appearance/icon-set-memory.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { IconName } from '../../shared/ui/icon';
import { Icon } from '../../shared/ui/icon';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';

const names: Record<ColorSchemeName, MessageKey> = {
    'spring-green': 'appearance.scheme.springGreen',
    'midnight-blue': 'appearance.scheme.midnightBlue',
    'velvet-violet': 'appearance.scheme.velvetViolet',
    ember: 'appearance.scheme.ember',
    'rose-noir': 'appearance.scheme.roseNoir',
    'graphite-gold': 'appearance.scheme.graphiteGold',
    'slate-orchid': 'appearance.scheme.slateOrchid',
    'charcoal-scarlet': 'appearance.scheme.charcoalScarlet',
};
const setNames: Record<IconSetName, MessageKey> = {
    lucide: 'appearance.iconSet.lucide',
    'solid-silhouettes': 'appearance.iconSet.solidSilhouettes',
    'hand-inked-editorial': 'appearance.iconSet.handInkedEditorial',
    'architectural-wireframes': 'appearance.iconSet.architecturalWireframes',
    'single-ink-risograph': 'appearance.iconSet.singleInkRisograph',
    'quiet-editorial-monoline': 'appearance.iconSet.quietEditorialMonoline',
};
const previewIcons: IconName[] = ['overview', 'books', 'collections', 'scan', 'lend'];

export function AppearancePage() {
    const { t } = useI18n();
    const { colorScheme, iconSet, saveColorScheme, saveIconSet } = useAppearance();
    const [selected, setSelected] = useState<ColorSchemeName>(colorScheme);
    const [selectedSet, setSelectedSet] = useState<IconSetName>(iconSet);
    const action = useAction();
    const iconAction = useAction();
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
    const chooseSet = (name: IconSetName) => {
        const previous = selectedSet;

        setSelectedSet(name);
        void iconAction.run(async () => {
            try {
                await saveIconSet(name);
            } catch (error) {
                setSelectedSet(previous);
                throw error;
            }
        }, 'appearance.iconSetSaved');
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
                                    <span className="scheme-choice__swatch scheme-choice__swatch--canvas" />
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
            <Panel title={t('appearance.iconSetTitle')}>
                <div className="form">
                    <fieldset className="icon-set-choices" disabled={iconAction.busy}>
                        <legend className="visually-hidden">{t('appearance.iconSetTitle')}</legend>
                        {IconSetMemory.names.map((name) => (
                            <label key={name} className="icon-set-choice">
                                <input
                                    type="radio"
                                    name="iconSet"
                                    value={name}
                                    checked={selectedSet === name}
                                    onChange={() => chooseSet(name)}
                                />
                                <span className="icon-set-choice__name">
                                    {t(setNames[name])}
                                    {name === 'lucide' && (
                                        <span className="field__hint">
                                            {' '}
                                            · {t('appearance.default')}
                                        </span>
                                    )}
                                </span>
                                <span className="icon-set-choice__preview" aria-hidden="true">
                                    {previewIcons.map((icon) => (
                                        <Icon key={icon} name={icon} set={name} size={28} />
                                    ))}
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <p className="field__hint">{t('appearance.iconSetHint')}</p>
                    {iconAction.feedback && (
                        <Notice tone={iconAction.feedback.tone}>{iconAction.feedback.text}</Notice>
                    )}
                </div>
            </Panel>
        </>
    );
}
