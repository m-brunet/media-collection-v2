import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface AuthorState {
    id: string;
    name: string;
    createdAt: string;
}

// A shared author identity linked to books. Correcting its name changes it on every linked book.
export class Author {
    private state: AuthorState;

    constructor(state: AuthorState) {
        this.state = { ...state, name: Author.name(state.name) };
    }

    get snapshot(): AuthorState {
        return { ...this.state };
    }

    // Equal keys mean the same author: case, accents and outer spaces are ignored.
    get key(): string {
        return NameKey.of(this.state.name);
    }

    static name(value: string): string {
        const name = value.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 200,
            'Enter an author name of up to 200 characters.',
            'author-name-invalid',
        );

        return name;
    }

    correct(name: string): void {
        this.state.name = Author.name(name);
    }
}
