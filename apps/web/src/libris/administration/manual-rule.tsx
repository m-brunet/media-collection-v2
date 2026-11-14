import type { ManualPortRule } from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';

export function ManualRule({
    rule,
    title = 'internet.manualTitle',
    intro = 'internet.manualIntro',
}: {
    rule: ManualPortRule;
    title?: MessageKey;
    intro?: MessageKey;
}) {
    const { t } = useI18n();

    return (
        <div>
            <h4 className="internet-access__subtitle">{t(title)}</h4>
            <p>{t(intro)}</p>
            <dl className="internet-access__facts">
                <div>
                    <dt>{t('internet.manualProtocol')}</dt>
                    <dd>{rule.protocol}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualExternal')}</dt>
                    <dd>{rule.externalPort}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualAddress')}</dt>
                    <dd>{rule.localAddress ?? t('internet.manualUnknown')}</dd>
                </div>
                <div>
                    <dt>{t('internet.manualInternal')}</dt>
                    <dd>{rule.internalPort}</dd>
                </div>
            </dl>
        </div>
    );
}
