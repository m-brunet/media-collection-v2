import type { InternetAccessStatus } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { QrCode } from '../../shared/ui/qr-code';

// An internet address (HTTP or HTTPS) as phones use it: the Leaf link and its QR code.
export function InternetAddress({ origin }: { origin: string }) {
    const { t } = useI18n();
    const leaf = origin + '/leaf/';

    return (
        <div className="internet-access__address">
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
            <figure className="internet-access__qr">
                <QrCode value={leaf} label={t('internet.qrAlt', { address: leaf })} />
                <figcaption className="muted">{t('internet.qr')}</figcaption>
            </figure>
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
