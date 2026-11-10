import type { InternetAccessStatus } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';

export function ManualRule({ rule }: { rule: NonNullable<InternetAccessStatus['manualRule']> }) {
    const { t } = useI18n();

    return (
        <div>
            <h4 className="internet-access__subtitle">{t('internet.manualTitle')}</h4>
            <p>{t('internet.manualIntro')}</p>
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
