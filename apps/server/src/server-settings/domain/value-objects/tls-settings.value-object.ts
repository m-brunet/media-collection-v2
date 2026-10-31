import { Failure } from '../../../shared/domain/exceptions/failure.js';

export interface TlsSettingsState {
    enabled: boolean;
    port: number;
    hasCertificate: boolean;
}

export class TlsSettings {
    private readonly state: Readonly<TlsSettingsState>;

    constructor(settings: TlsSettingsState) {
        const state = {
            enabled: settings.enabled,
            port: settings.port,
            hasCertificate: settings.hasCertificate,
        };

        Failure.ensure(
            Number.isInteger(state.port) && state.port >= 1024 && state.port <= 65535,
            'HTTPS port must be an integer between 1024 and 65535.',
        );
        Failure.ensure(
            !state.enabled || state.hasCertificate,
            'Supply a certificate and private key before enabling HTTPS.',
        );
        this.state = Object.freeze(state);
        Object.freeze(this);
    }

    get enabled(): boolean {
        return this.state.enabled;
    }

    get port(): number {
        return this.state.port;
    }

    get hasCertificate(): boolean {
        return this.state.hasCertificate;
    }

    snapshot(): TlsSettingsState {
        return { ...this.state };
    }
}
