import { Failure } from '../../../shared/domain/exceptions/failure.js';

export interface HttpSettingsState {
    port: number;
}

export class HttpSettings {
    constructor(private readonly portValue: number) {
        Failure.ensure(
            Number.isInteger(portValue) && portValue >= 1024 && portValue <= 65535,
            'HTTP port must be an integer between 1024 and 65535.',
        );
        Object.freeze(this);
    }

    get port(): number {
        return this.portValue;
    }

    snapshot(): HttpSettingsState {
        return { port: this.portValue };
    }
}
