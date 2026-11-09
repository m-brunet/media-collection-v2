import { useState } from 'react';
import type { HttpInternetAccessStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';
import { InternetAddress, ManualRule } from './internet-address';

const failures: Record<NonNullable<HttpInternetAccessStatus['failure']>['reason'], MessageKey> = {
    'no-router': 'internet.failure.no-router',
    'port-refused': 'internet.httpPortRefused',
    cgnat: 'internet.failure.cgnat',
    'double-nat': 'internet.failure.double-nat',
    'public-address-unknown': 'internet.failure.public-address-unknown',
    'setup-failed': 'internet.failure.setup-failed',
};

// Plain HTTP from the internet: the Admin's choice when HTTPS does not work, with its warning.
// Closed by a working HTTPS, and never offered while HTTPS is on.
export function HttpInternetSection({
    status,
    httpsActive,
    onChanged,
}: {
    status: HttpInternetAccessStatus;
    httpsActive: boolean;
    onChanged(): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const [confirming, setConfirming] = useState(false);
    const failure = status.failure ? t(failures[status.failure.reason]) : null;
    const close = () =>
        void action.run(async () => {
            await api.request<HttpInternetAccessStatus>('/server-settings/internet-access/http', {
                method: 'DELETE',
            });
            onChanged();
        });

    return (
        <section className="internet-access__section" aria-labelledby="http-internet-title">
            <h3 id="http-internet-title" className="internet-access__subtitle">
                {t('internet.httpTitle')}
            </h3>
            <Notice tone="warning">{t('internet.httpWarning')}</Notice>
            {status.phase === 'open' && (
                <>
                    <Notice tone="success">{t('internet.httpIsOpen')}</Notice>
                    {failure && <Notice tone="warning">{failure}</Notice>}
                    {status.manualRule && <ManualRule rule={status.manualRule} />}
                    {status.origin && <InternetAddress origin={status.origin} />}
                </>
            )}
            {status.phase === 'off' && status.closedByHttps && (
                <Notice>{t('internet.httpClosedByHttps')}</Notice>
            )}
            {status.phase === 'off' && failure && <Notice tone="error">{failure}</Notice>}
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
            <div className="actions">
                {status.phase === 'open' && (
                    <Button busy={action.busy} onClick={close}>
                        {t('internet.httpClose')}
                    </Button>
                )}
                {status.phase === 'off' && !httpsActive && (
                    <Button busy={action.busy} onClick={() => setConfirming(true)}>
                        {t('internet.httpOpen')}
                    </Button>
                )}
            </div>
            {status.phase === 'off' && httpsActive && !status.closedByHttps && (
                <p className="muted">{t('internet.httpHttpsActive')}</p>
            )}
            <ConfirmDialog
                open={confirming}
                title={t('internet.httpConfirmTitle')}
                body={t('internet.httpWarning')}
                confirm={t('internet.httpConfirm')}
                onConfirm={async () => {
                    await api.request<HttpInternetAccessStatus>(
                        '/server-settings/internet-access/http',
                        { method: 'POST' },
                    );
                    setConfirming(false);
                    onChanged();
                }}
                onClose={() => setConfirming(false)}
            />
        </section>
    );
}
