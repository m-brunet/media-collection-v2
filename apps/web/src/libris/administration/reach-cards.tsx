import { useState } from 'react';
import type {
    HttpInternetAccessStatus,
    InternetAccessStatus,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { QrCode } from '../../shared/ui/qr-code';
import { ServerAddress } from './server-address.util';
import type { PillTone } from './status-pill';
import { StatusPill } from './status-pill';
import { usePairingLink } from './use-pairing-link';

interface Place {
    id: 'computer' | 'home' | 'internet';
    name: MessageKey;
    addresses: string[];
    pill: { tone: PillTone; label: MessageKey };
    note: string;
    missing: MessageKey;
}

class InternetPill {
    static of(https: InternetAccessStatus, http: HttpInternetAccessStatus): Place['pill'] {
        if (https.phase === 'active') {
            return { tone: 'on', label: 'reach.onHttps' };
        }

        if (http.phase === 'open') {
            return { tone: 'warn', label: 'reach.onHttp' };
        }

        if (https.phase === 'setting-up') {
            return { tone: 'off', label: 'reach.settingUp' };
        }

        return https.phase === 'waiting-for-port'
            ? { tone: 'warn', label: 'reach.needsHelp' }
            : { tone: 'off', label: 'reach.off' };
    }
}

function usePlaces(
    running: readonly string[],
    https: InternetAccessStatus,
    http: HttpInternetAccessStatus,
): Place[] {
    const { t, dates } = useI18n();
    const local = running.filter((address) => ServerAddress.loopback(address));
    const home = running.filter((address) => !ServerAddress.loopback(address));
    const online = [https.phase === 'active' ? https.origin : null, http.origin].filter(
        (origin): origin is string => origin !== null,
    );
    const reached = (addresses: string[]): Place['pill'] =>
        addresses.length > 0
            ? { tone: 'on', label: 'reach.on' }
            : { tone: 'off', label: 'reach.off' };
    const internetNote =
        https.phase === 'active'
            ? [
                  t('reach.internetOn'),
                  ...(https.certificate
                      ? [
                            t('internet.validUntil', {
                                date: dates.dateTime(https.certificate.expiresAt),
                            }),
                        ]
                      : []),
              ].join(' ')
            : http.phase === 'open'
              ? t('reach.internetHttp')
              : https.phase === 'setting-up'
                ? t('reach.internetSettingUp')
                : https.phase === 'waiting-for-port'
                  ? t('reach.internetWaiting')
                  : t('reach.internetOff');

    return [
        {
            id: 'computer',
            name: 'reach.computer',
            addresses: local,
            pill: reached(local),
            note: t('reach.computerNote'),
            missing: 'reach.noAddress',
        },
        {
            id: 'home',
            name: 'reach.home',
            addresses: home,
            pill: reached(home),
            note: t('reach.homeNote'),
            missing: 'reach.noAddress',
        },
        {
            id: 'internet',
            name: 'reach.internet',
            addresses: online,
            pill: InternetPill.of(https, http),
            note: internetNote,
            missing: https.phase === 'off' ? 'reach.notSetUp' : 'reach.notYet',
        },
    ];
}

export function ReachCards({
    addresses,
    internetAccess,
    httpInternetAccess,
}: {
    addresses: string[];
    internetAccess: InternetAccessStatus;
    httpInternetAccess: HttpInternetAccessStatus;
}) {
    const { t } = useI18n();
    const { account } = useSession();
    const [selected, setSelected] = useState<string | null>(null);
    const places = usePlaces(addresses, internetAccess, httpInternetAccess);
    const shown = places.some((place) => selected && place.addresses.includes(selected))
        ? selected
        : null;
    const leaf = shown ? ServerAddress.leaf(shown) : null;
    const pairing = usePairingLink(shown === httpInternetAccess.origin ? null : shown);

    return (
        <div className="reach" role="group" aria-label={t('reach.title')}>
            {places.map((place) => (
                <section
                    key={place.id}
                    className={
                        'place-card' +
                        (shown && place.addresses.includes(shown) ? ' place-card--current' : '')
                    }
                    aria-labelledby={'place-' + place.id}
                >
                    <div className="place-card__head">
                        <h2 id={'place-' + place.id} className="place-card__name">
                            {t(place.name)}
                        </h2>
                        <StatusPill tone={place.pill.tone} label={t(place.pill.label)} />
                    </div>
                    <ul className="place-card__addresses">
                        {place.addresses.length === 0 && (
                            <li className="place-card__missing">{t(place.missing)}</li>
                        )}
                        {place.addresses.map((address) => (
                            <li key={address} className="place-card__address">
                                <a href={address}>{address}</a>
                                {!ServerAddress.loopback(address) && (
                                    <Button
                                        icon="qr"
                                        className="qr-button"
                                        aria-pressed={address === shown}
                                        aria-controls="address-qr"
                                        aria-label={t('server.qrShowFor', { address })}
                                        onClick={() => setSelected(address)}
                                    >
                                        {address === shown
                                            ? t('reach.qrShown')
                                            : t('server.qrShow')}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="place-card__note">{place.note}</p>
                </section>
            ))}
            <aside
                id="address-qr"
                className="qr-card"
                aria-live="polite"
                aria-label={t('reach.qrTitle')}
            >
                {!leaf && (
                    <div className="qr-card__empty">
                        <Icon name="qr" size={36} />
                        <p>{t('reach.qrInvite')}</p>
                    </div>
                )}
                {leaf && pairing.ready && (
                    <div className="qr-card__shown">
                        <QrCode
                            value={pairing.link?.link ?? leaf}
                            label={t('internet.qrAlt', { address: leaf })}
                        />
                        <p className="qr-card__caption">{t('server.qrCaption')}</p>
                        <p className="qr-card__url">{leaf}</p>
                        {pairing.link && account && (
                            <p className="qr-card__pairing">
                                {t('server.qrPairing', { username: account.username })}
                            </p>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}
