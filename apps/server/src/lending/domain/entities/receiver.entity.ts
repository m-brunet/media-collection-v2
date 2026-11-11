import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface ReceiverState {
    id: string;
    name: string;
    createdAt: string;
}

export class Receiver {
    private readonly state: ReceiverState;

    constructor(state: ReceiverState) {
        this.state = { ...state, name: Receiver.validName(state.name) };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): ReceiverState {
        return { ...this.state };
    }

    get key(): string {
        return NameKey.of(this.state.name);
    }

    static validName(value: string): string {
        const name = value.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 100,
            'Enter a receiver name of up to 100 characters.',
            'receiver-name-invalid',
        );

        return name;
    }
}
