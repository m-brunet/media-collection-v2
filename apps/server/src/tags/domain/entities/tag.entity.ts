import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface TagState {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

// A reusable label for books, independent of collections and shelves. Equivalent names are the
// same tag; an unused tag remains until deleted.
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

    // Equal keys mean the same tag: case, accents and outer spaces are ignored.
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
