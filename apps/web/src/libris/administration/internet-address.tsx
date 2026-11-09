import type { InternetAccessStatus } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';

// An internet address (HTTP or HTTPS) as phones use it: the Leaf link. Its QR code is in the
// addresses list, with the other addresses.
export function InternetAddress({ origin }: { origin: string }) {
    const { t } = useI18n();
    const leaf = origin + '/leaf/';

    return (
        <div>
            <dl className="internet-access__facts">
                <div>
                    <dt>{t('internet.address')}</dt>
                    <dd>
                        <a href={leaf} target="_blank" rel="noreferrer">
                            {leaf}
                        </a>
                    </dd>
                </div>
            </dl>
            <p className="muted">{t('internet.qrInAddresses')}</p>
        </div>
    );
}

// The router rule the Admin adds by hand when the application could not.
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
