import { useState } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { QrCode } from '../../shared/ui/qr-code';
import { ServerAddress } from './server-address.util';
import { usePairingLink } from './use-pairing-link';

export function AddressesPanel({
    addresses,
    httpInternetAddress,
    httpsPort,
    httpsError,
}: {
    addresses: string[];
    httpInternetAddress: string | null;
    httpsPort: number | null;
    httpsError: string | null;
}) {
    const { t } = useI18n();
    const { account } = useSession();
    const [selected, setSelected] = useState<string | null>(null);
    const leaf = selected ? ServerAddress.leaf(selected) : null;
    const pairing = usePairingLink(selected === httpInternetAddress ? null : selected);

    return (
        <Panel title={t('server.listeners')}>
            <div className={'address-panel' + (leaf ? ' address-panel--qr' : '')}>
                <div>
                    <ul className="address-list">
                        {addresses.map((address) => (
                            <li key={address} className="address-list__row">
                                <a href={address}>{address}</a>
                                {!ServerAddress.loopback(address) && (
                                    <Button
                                        icon="qr"
                                        className="qr-button"
                                        aria-pressed={address === selected}
                                        aria-controls="address-qr"
                                        aria-label={t('server.qrShowFor', { address })}
                                        onClick={() => setSelected(address)}
                                    >
                                        {t('server.qrShow')}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="address-panel__status">
                        {httpsPort
                            ? t('server.httpsRunning', { port: httpsPort })
                            : t('server.httpsStopped')}
                    </p>
                    {httpsError && <Notice tone="error">{httpsError}</Notice>}
                </div>
                <div id="address-qr" className="address-qr" aria-live="polite" hidden={!leaf}>
                    {leaf && pairing.ready && (
                        <>
                            <QrCode
                                value={pairing.link?.link ?? leaf}
                                label={t('internet.qrAlt', { address: leaf })}
                            />
                            <p className="address-qr__caption">{t('server.qrCaption')}</p>
                            {pairing.link && account && (
                                <p className="address-qr__caption">
                                    {t('server.qrPairing', { username: account.username })}
                                </p>
                            )}
                            <p className="address-qr__url">{leaf}</p>
                        </>
                    )}
                </div>
            </div>
        </Panel>
    );
}
