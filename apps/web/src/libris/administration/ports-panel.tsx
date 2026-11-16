import type { FormEvent } from 'react';
import type { ServerStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';
import { SettingIds, SettingRow } from './setting-row';

const overrideNotice: Record<
    NonNullable<ServerStatus['running']['httpPortOverride']>['source'],
    MessageKey
> = {
    'command-line': 'server.overrideCommandLine',
    environment: 'server.overrideEnvironment',
    'config-file': 'server.overrideConfigFile',
};

export function PortsPanel({
    settings,
    onSaved,
}: {
    settings: ServerStatus;
    onSaved(settings: ServerStatus): void;
}) {
    const { t } = useI18n();
    const http = useAction();
    const https = useAction();
    const saving = http.busy || https.busy;
    const submitHttp = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const port = Number(new FormData(event.currentTarget).get('httpPort'));
        const success: MessageKey =
            port === settings.running.httpPort
                ? 'server.httpSavedActive'
                : settings.running.httpPortOverride
                  ? 'server.httpSavedOverride'
                  : 'server.httpSavedRestart';

        void http.run(async () => {
            onSaved(
                await api.request<ServerStatus>('/server-settings/http', {
                    method: 'PUT',
                    body: { port },
                }),
            );
        }, success);
    };
    const submitHttps = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const port = Number(new FormData(event.currentTarget).get('httpsPort'));
        const success: MessageKey =
            port === settings.running.httpsPort
                ? 'server.httpsPortSavedActive'
                : 'server.httpsPortSavedRestart';

        void https.run(async () => {
            onSaved(
                await api.request<ServerStatus>('/server-settings/https-port', {
                    method: 'PUT',
                    body: { port },
                }),
            );
        }, success);
    };
    const httpsDetail = [
        t('server.httpsPortDetail'),
        settings.running.httpsPort
            ? t('server.httpsRunning', { port: settings.running.httpsPort })
            : t('server.httpsStopped'),
    ].join(' ');

    return (
        <Panel title={t('server.portsTitle')}>
            <p className="muted">{t('server.portsIntro')}</p>
            <div className="setting-rows">
                <SettingRow
                    id="http-port"
                    title={t('server.httpPort')}
                    detail={t('server.httpPortDetail', { running: settings.running.httpPort })}
                    control={
                        <form
                            className="setting-row__form"
                            onSubmit={submitHttp}
                            aria-label={t('server.httpTitle')}
                        >
                            <PortField
                                id="http-port"
                                name="httpPort"
                                label={t('server.httpPort')}
                                value={settings.configured.http.port}
                            />
                            <Button type="submit" disabled={saving} busy={http.busy}>
                                {t('server.httpSubmit')}
                            </Button>
                        </form>
                    }
                >
                    {settings.running.httpPortOverride && (
                        <Notice tone="warning">
                            {t(overrideNotice[settings.running.httpPortOverride.source], {
                                port: settings.running.httpPortOverride.port,
                            })}
                        </Notice>
                    )}
                    {settings.configured.http.port !== settings.running.httpPort && (
                        <div>
                            <p>{t('server.nextAddresses')}</p>
                            <ul className="address-list">
                                {settings.running.addresses.map((address) => {
                                    const next = new URL(address);

                                    next.port = String(settings.configured.http.port);

                                    return <li key={address}>{next.origin}</li>;
                                })}
                            </ul>
                        </div>
                    )}
                    {http.feedback && (
                        <Notice tone={http.feedback.tone}>{http.feedback.text}</Notice>
                    )}
                </SettingRow>
                <SettingRow
                    id="https-port"
                    title={t('server.httpsPort')}
                    detail={httpsDetail}
                    control={
                        <form
                            className="setting-row__form"
                            onSubmit={submitHttps}
                            aria-label={t('server.httpsPortTitle')}
                        >
                            <PortField
                                id="https-port"
                                name="httpsPort"
                                label={t('server.httpsPort')}
                                value={settings.configured.tls.port}
                            />
                            <Button type="submit" disabled={saving} busy={https.busy}>
                                {t('server.httpsPortSubmit')}
                            </Button>
                        </form>
                    }
                >
                    {settings.running.httpsError && (
                        <Notice tone="error">{settings.running.httpsError}</Notice>
                    )}
                    {https.feedback && (
                        <Notice tone={https.feedback.tone}>{https.feedback.text}</Notice>
                    )}
                </SettingRow>
            </div>
        </Panel>
    );
}

function PortField({
    id,
    name,
    label,
    value,
}: {
    id: string;
    name: string;
    label: string;
    value: number;
}) {
    const { t } = useI18n();

    return (
        <>
            <input
                name={name}
                type="number"
                className="field__control setting-row__field"
                defaultValue={value}
                min={1024}
                max={65535}
                step={1}
                required
                aria-label={label}
                aria-describedby={SettingIds.detail(id) + ' ' + id + '-rule'}
            />
            <span id={id + '-rule'} className="visually-hidden">
                {t('server.portRule')}
            </span>
        </>
    );
}
