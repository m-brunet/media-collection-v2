import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { ServerStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { TextAreaField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { AddressesPanel } from './addresses-panel';
import { InternetAccessPanel } from './internet-access-panel';
import { PortsPanel } from './ports-panel';

const followInterval = 1500;

export function ServerSettingsPage() {
    const { t } = useI18n();
    const [settings, setSettings] = useState<ServerStatus | null>(null);
    const load = useAction();
    const https = useAction();
    const { run } = load;

    useEffect(() => {
        void run(async () => setSettings(await api.request<ServerStatus>('/server-settings')));
    }, [run]);

    const settingUp =
        settings?.internetAccess.phase === 'setting-up' ||
        (settings?.internetAccess.phase === 'active' && settings.internetAccess.step !== null);

    useEffect(() => {
        if (!settingUp) {
            return;
        }

        const timer = setInterval(() => {
            void api
                .request<ServerStatus>('/server-settings', { passive: true })
                .then(setSettings, () => undefined);
        }, followInterval);

        return () => clearInterval(timer);
    }, [settingUp]);

    const managed = settings ? settings.internetAccess.phase !== 'off' : false;
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
                    <InternetAccessPanel
                        status={settings.internetAccess}
                        http={settings.httpInternetAccess}
                        domainName={settings.domainName}
                        keepAwake={settings.keepAwake}
                        onStatus={(internetAccess) =>
                            void api
                                .request<ServerStatus>('/server-settings', { passive: true })
                                .then(setSettings, () =>
                                    setSettings({ ...settings, internetAccess }),
                                )
                        }
                        onRefresh={() =>
                            void api
                                .request<ServerStatus>('/server-settings', { passive: true })
                                .then(setSettings, () => undefined)
                        }
                        onKeepAwake={(keepAwake) => setSettings({ ...settings, keepAwake })}
                    />
                    <AddressesPanel
                        addresses={[
                            ...settings.running.addresses,
                            ...[
                                settings.httpInternetAccess.origin,
                                settings.internetAccess.origin,
                            ].filter((origin): origin is string => origin !== null),
                        ]}
                        httpInternetAddress={settings.httpInternetAccess.origin}
                        httpsPort={settings.running.httpsPort}
                        httpsError={settings.running.httpsError}
                    />
                    <PortsPanel settings={settings} onSaved={setSettings} />
                    <details className="advanced-settings">
                        <summary>{t('server.advanced')}</summary>
                        <div className="panel-grid">
                            <Panel title={t('server.httpsTitle')}>
                                <form
                                    className="form"
                                    onSubmit={submitHttps}
                                    aria-label={t('server.httpsTitle')}
                                >
                                    {managed && (
                                        <Notice tone="info">{t('server.httpsManaged')}</Notice>
                                    )}
                                    <label className="checkbox">
                                        <input
                                            name="enabled"
                                            type="checkbox"
                                            defaultChecked={settings.configured.tls.enabled}
                                        />
                                        {t('server.httpsEnable')}
                                    </label>
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
                                            disabled={managed}
                                            busy={https.busy}
                                        >
                                            {t('server.httpsSubmit')}
                                        </Button>
                                    </div>
                                </form>
                            </Panel>
                        </div>
                    </details>
                </div>
            )}
        </>
    );
}
