import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { ServerStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { TextAreaField, TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

export function ServerSettingsPage() {
    const { t } = useI18n();
    const [settings, setSettings] = useState<ServerStatus | null>(null);
    const load = useAction();
    const http = useAction();
    const https = useAction();
    const saving = http.busy || https.busy;
    const { run } = load;

    useEffect(() => {
        void run(async () => setSettings(await api.request<ServerStatus>('/server-settings')));
    }, [run]);

    const submitHttp = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const port = Number(new FormData(event.currentTarget).get('httpPort'));
        const success: MessageKey =
            port === settings?.running.httpPort
                ? 'server.httpSavedActive'
                : settings?.running.httpPortOverride
                  ? 'server.httpSavedOverride'
                  : 'server.httpSavedRestart';

        void http.run(async () => {
            setSettings(
                await api.request<ServerStatus>('/server-settings/http', {
                    method: 'PUT',
                    body: { port },
                }),
            );
        }, success);
    };
    const submitHttps = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        const chain = String(form.get('chain') ?? '').trim();
        const key = String(form.get('key') ?? '').trim();

        void https.run(async () => {
            setSettings(
                await api.request<ServerStatus>('/server-settings', {
                    method: 'PUT',
                    body: {
                        enabled: form.get('enabled') === 'on',
                        port: Number(form.get('port')),
                        ...(chain || key ? { chain, key } : {}),
                    },
                }),
            );
            (element.elements.namedItem('key') as HTMLTextAreaElement).value = '';
            (element.elements.namedItem('chain') as HTMLTextAreaElement).value = '';
        }, 'server.httpsSaved');
    };

    return (
        <>
            <PageHeader title={t('server.title')} intro={t('server.intro')} />
            {load.feedback && <Notice tone="error">{load.feedback.text}</Notice>}
            {!settings && !load.feedback && <LoadingState label={t('common.loading')} />}
            {settings && (
                <div className="stack">
                    {settings.restartRequired && (
                        <Notice tone="warning">{t('server.restartRequired')}</Notice>
                    )}
                    <Panel title={t('server.listeners')}>
                        <ul className="plain-list">
                            {settings.running.addresses.map((address) => (
                                <li key={address}>
                                    <a href={address}>{address}</a>
                                </li>
                            ))}
                        </ul>
                        <p>
                            {settings.running.httpsPort
                                ? t('server.httpsRunning', { port: settings.running.httpsPort })
                                : t('server.httpsStopped')}
                        </p>
                        {settings.running.httpsError && (
                            <Notice tone="error">{settings.running.httpsError}</Notice>
                        )}
                        <p className="muted">{t('server.internet')}</p>
                    </Panel>
                    <div className="panel-grid">
                        <Panel title={t('server.httpTitle')}>
                            <form
                                className="form"
                                onSubmit={submitHttp}
                                aria-label={t('server.httpTitle')}
                            >
                                <p className="muted">
                                    {t('server.httpIntro', {
                                        running: settings.running.httpPort,
                                        saved: settings.configured.http.port,
                                    })}
                                </p>
                                {settings.running.httpPortOverride && (
                                    <Notice tone="warning">
                                        {t(
                                            settings.running.httpPortOverride.source ===
                                                'command-line'
                                                ? 'server.overrideCommandLine'
                                                : 'server.overrideEnvironment',
                                            { port: settings.running.httpPortOverride.port },
                                        )}
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
                                        <ul className="plain-list">
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
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={saving}
                                        busy={http.busy}
                                    >
                                        {t('server.httpSubmit')}
                                    </Button>
                                </div>
                            </form>
                        </Panel>
                        <Panel title={t('server.httpsTitle')}>
                            <form
                                className="form"
                                onSubmit={submitHttps}
                                aria-label={t('server.httpsTitle')}
                            >
                                <label className="checkbox">
                                    <input
                                        name="enabled"
                                        type="checkbox"
                                        defaultChecked={settings.configured.tls.enabled}
                                    />
                                    {t('server.httpsEnable')}
                                </label>
                                <TextField
                                    label={t('server.httpsPort')}
                                    name="port"
                                    type="number"
                                    defaultValue={settings.configured.tls.port}
                                    hint={t('server.portRule')}
                                    min={1024}
                                    max={65535}
                                    step={1}
                                    required
                                />
                                <p className="muted">
                                    {t(
                                        settings.configured.tls.hasCertificate
                                            ? 'server.certificateSaved'
                                            : 'server.certificateMissing',
                                    )}
                                </p>
                                <TextAreaField
                                    label={t('server.chain')}
                                    name="chain"
                                    rows={5}
                                    spellCheck={false}
                                    placeholder="-----BEGIN CERTIFICATE-----"
                                />
                                <TextAreaField
                                    label={t('server.key')}
                                    name="key"
                                    rows={5}
                                    spellCheck={false}
                                    placeholder="-----BEGIN PRIVATE KEY-----"
                                />
                                {https.feedback && (
                                    <Notice tone={https.feedback.tone}>
                                        {https.feedback.text}
                                    </Notice>
                                )}
                                <div className="actions">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={saving}
                                        busy={https.busy}
                                    >
                                        {t('server.httpsSubmit')}
                                    </Button>
                                </div>
                            </form>
                        </Panel>
                    </div>
                </div>
            )}
        </>
    );
}
