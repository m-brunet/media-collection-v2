import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { ServerStatus } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useAction } from '../../shared/use-action';

export function ServerSettings() {
    const [ settings, setSettings ] = useState<ServerStatus | null>(null);
    const action = useAction();
    const httpAction = useAction();
    const { setMessage } = httpAction;
    const saving = action.busy || httpAction.busy;

    useEffect(() => {
        void api.request<ServerStatus>('/server-settings')
            .then(setSettings)
            .catch((error) => setMessage(String(error.message)));
    }, [ setMessage ]);
    const submitHttp = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const port = Number(form.get('httpPort'));
        const success =
            port === settings?.running.httpPort
                ? 'HTTP port saved. This port is already active.'
                : settings?.running.httpPortOverride
                    ? 'HTTP port saved. Remove the startup port override, then close and reopen the desktop application to apply it.'
                    : 'HTTP port saved. Close and reopen the desktop application to apply it.';

        void httpAction.run(async () => {
            setSettings(
                await api.request<ServerStatus>('/server-settings/http', {
                    method: 'PUT',
                    body: { port }
                })
            );
        }, success);
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        const chain = String(form.get('chain') ?? '').trim();
        const key = String(form.get('key') ?? '').trim();

        void action.run(async () => {
            setSettings(
                await api.request<ServerStatus>('/server-settings', {
                    method: 'PUT',
                    body: {
                        enabled: form.get('enabled') === 'on',
                        port: Number(form.get('port')),
                        ...(chain || key ? { chain, key } : {})
                    },
                }),
            );
            (element.elements.namedItem('key') as HTMLTextAreaElement).value = '';
            (element.elements.namedItem('chain') as HTMLTextAreaElement).value = '';
        }, 'Settings saved. Restart the desktop application to apply them.');
    };

    return (
        <section className="card">
            <h1>Server settings</h1>
            { settings && (
                <>
                    <h2>Current listeners</h2>
                    <ul>
                        { settings.running.addresses.map((address) => (
                            <li key={ address }>
                                <a href={ address }>{ address }</a>
                            </li>
                        )) }
                    </ul>
                    <p>
                        HTTPS:{ ' ' }
                        { settings.running.httpsPort
                            ? 'running on port ' + settings.running.httpsPort
                            : 'not running' }
                        .
                    </p>
                    { settings.running.httpsError && (
                        <p role="alert">{ settings.running.httpsError }</p>
                    ) }
                    { settings.restartRequired && (
                        <p className="notice">
                            Saved settings are waiting for a desktop application restart. Close and
                            reopen the application to apply them.
                        </p>
                    ) }
                    <p>
                        Internet access uses your router’s port forwarding and the computer’s
                        firewall. HTTP remains available when HTTPS is enabled.
                    </p>
                    <form onSubmit={ submitHttp } aria-label="HTTP settings">
                        <h2>HTTP / web interface</h2>
                        <p>
                            External browsers use this port to access the web interface and its API.
                            HTTP is currently listening on port { settings.running.httpPort }. The
                            saved port is { settings.configured.http.port }.
                        </p>
                        { settings.running.httpPortOverride && (
                            <p className="notice">
                                A{ ' ' }
                                { settings.running.httpPortOverride.source === 'command-line'
                                    ? 'command-line'
                                    : 'startup environment' }{ ' ' }
                                port override is active on port{ ' ' }
                                { settings.running.httpPortOverride.port }. Remove that override, then
                                close and reopen the desktop application to use the saved port.
                            </p>
                        ) }
                        <label>
                            HTTP port
                            <input
                                name="httpPort"
                                type="number"
                                defaultValue={ settings.configured.http.port }
                                min={ 1024 }
                                max={ 65535 }
                                step={ 1 }
                                required
                            />
                        </label>
                        <p className="muted">Choose an integer from 1024 to 65535.</p>
                        { settings.configured.http.port !== settings.running.httpPort && (
                            <>
                                <p>Web addresses after applying the saved HTTP port:</p>
                                <ul>
                                    { settings.running.addresses.map((address) => {
                                        const next = new URL(address);

                                        next.port = String(settings.configured.http.port);

                                        return <li key={ address }>{ next.origin }</li>;
                                    }) }
                                </ul>
                            </>
                        ) }
                        <button disabled={ saving }>Save HTTP port</button>
                        <p role="status">{ httpAction.message }</p>
                    </form>
                    <form onSubmit={ submit } aria-label="HTTPS settings">
                        <h2>Optional HTTPS</h2>
                        <label className="checkbox">
                            <input
                                name="enabled"
                                type="checkbox"
                                defaultChecked={ settings.configured.tls.enabled }
                            />{ ' ' }
                            Enable HTTPS after restart
                        </label>
                        <label>
                            HTTPS port
                            <input
                                name="port"
                                type="number"
                                defaultValue={ settings.configured.tls.port }
                                min={ 1024 }
                                max={ 65535 }
                                step={ 1 }
                                required
                            />
                        </label>
                        <p className="muted">
                            { settings.configured.tls.hasCertificate
                                ? 'A certificate is saved. Leave both fields empty to keep it.'
                                : 'Supply a PEM certificate chain and its matching private key.' }
                        </p>
                        <label>
                            PEM certificate chain
                            <textarea
                                name="chain"
                                rows={ 5 }
                                spellCheck={ false }
                                placeholder="-----BEGIN CERTIFICATE-----"
                            />
                        </label>
                        <label>
                            PEM private key
                            <textarea
                                name="key"
                                rows={ 5 }
                                spellCheck={ false }
                                placeholder="-----BEGIN PRIVATE KEY-----"
                            />
                        </label>
                        <button disabled={ saving }>Save HTTPS settings</button>
                    </form>
                </>
            ) }
            <p role="status">{ action.message }</p>
            { !settings && <p role="status">{ httpAction.message }</p> }
        </section>
    );
}
