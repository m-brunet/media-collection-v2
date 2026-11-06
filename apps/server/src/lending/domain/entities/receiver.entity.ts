import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface ReceiverState {
    id: string;
    name: string;
    createdAt: string;
}

// A person books are lent to, known only by a name or nickname. A receiver is not an account and
// gets no permissions. Equivalent names are the same receiver.
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

    // Equal keys mean the same receiver: case, accents and outer spaces are ignored.
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
