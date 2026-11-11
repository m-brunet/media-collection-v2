import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface TagState {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export class Tag {
    private state: TagState;

    constructor(state: TagState) {
        this.state = { ...state, name: Tag.validName(state.name) };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): TagState {
        return { ...this.state };
    }

    get key(): string {
        return NameKey.of(this.state.name);
    }

    static validName(value: string): string {
        const name = value.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 100,
            'Enter a tag name of up to 100 characters.',
            'tag-name-invalid',
        );

        return name;
    }

    rename(name: string, now: string): void {
        this.state.name = Tag.validName(name);
        this.state.updatedAt = now;
    }
}
