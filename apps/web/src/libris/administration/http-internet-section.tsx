import { useState } from 'react';
import type { HttpInternetAccessStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';
import { ManualRule } from './manual-rule';
import { SettingRow } from './setting-row';
import { StatusPill } from './status-pill';

const failures: Record<NonNullable<HttpInternetAccessStatus['failure']>['reason'], MessageKey> = {
    'no-router': 'internet.failure.no-router',
    'port-refused': 'internet.httpPortRefused',
    cgnat: 'internet.failure.cgnat',
    'double-nat': 'internet.failure.double-nat',
    'public-address-unknown': 'internet.failure.public-address-unknown',
    'setup-failed': 'internet.failure.setup-failed',
};

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
    const open = status.phase === 'open';
    const closedByHttps = status.phase === 'off' && httpsActive;

    return (
        <SettingRow
            id="http-internet"
            title={t('internet.httpTitle')}
            detail={closedByHttps ? t('internet.httpHttpsActive') : t('internet.httpDetail')}
            control={
                <>
                    <StatusPill
                        tone={open ? 'warn' : 'off'}
                        label={t(open ? 'setting.open' : 'setting.closed')}
                    />
                    {open && (
                        <Button busy={action.busy} onClick={close}>
                            {t('internet.httpClose')}
                        </Button>
                    )}
                    {status.phase === 'off' && !httpsActive && (
                        <Button busy={action.busy} onClick={() => setConfirming(true)}>
                            {t('internet.httpOpen')}
                        </Button>
                    )}
                </>
            }
        >
            {!closedByHttps && <Notice tone="warning">{t('internet.httpWarning')}</Notice>}
            {status.phase === 'off' && status.closedByHttps && (
                <Notice>{t('internet.httpClosedByHttps')}</Notice>
            )}
            {failure && <Notice tone={open ? 'warning' : 'error'}>{failure}</Notice>}
            {open && status.manualRule && <ManualRule rule={status.manualRule} />}
            {action.feedback && <Notice tone={action.feedback.tone}>{action.feedback.text}</Notice>}
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
        </SettingRow>
    );
}
