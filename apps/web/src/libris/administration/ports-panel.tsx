import type { FormEvent } from 'react';
import type { ServerStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

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

    return (
        <Panel title={t('server.portsTitle')}>
            <p className="muted">{t('server.portsIntro')}</p>
            <div className="panel-grid">
                <form className="form" onSubmit={submitHttp} aria-label={t('server.httpTitle')}>
                    <p className="muted">
                        {t('server.httpIntro', {
                            running: settings.running.httpPort,
                            saved: settings.configured.http.port,
                        })}
                    </p>
                    {settings.running.httpPortOverride && (
                        <Notice tone="warning">
                            {t(overrideNotice[settings.running.httpPortOverride.source], {
                                port: settings.running.httpPortOverride.port,
                            })}
                        </Notice>
                    )}
                    <TextField
                        label={t('server.httpPort')}
                        name="httpPort"
                        type="number"
                        defaultValue={settings.configured.http.port}
                        hint={t('server.portRule')}
                        min={1024}
                        max={65535}
                        step={1}
                        required
                    />
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
                    <div className="actions">
                        <Button type="submit" variant="primary" disabled={saving} busy={http.busy}>
                            {t('server.httpSubmit')}
                        </Button>
                    </div>
                </form>
                <form
                    className="form"
                    onSubmit={submitHttps}
                    aria-label={t('server.httpsPortTitle')}
                >
                    <p className="muted">{t('server.httpsPortIntro')}</p>
                    <TextField
                        label={t('server.httpsPort')}
                        name="httpsPort"
                        type="number"
                        defaultValue={settings.configured.tls.port}
                        hint={t('server.portRule')}
                        min={1024}
                        max={65535}
                        step={1}
                        required
                    />
                    {https.feedback && (
                        <Notice tone={https.feedback.tone}>{https.feedback.text}</Notice>
                    )}
                    <div className="actions">
                        <Button type="submit" variant="primary" disabled={saving} busy={https.busy}>
                            {t('server.httpsPortSubmit')}
                        </Button>
                    </div>
                </form>
            </div>
        </Panel>
    );
}
