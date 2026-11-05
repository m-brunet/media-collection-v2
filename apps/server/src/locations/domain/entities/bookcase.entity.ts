import { LocationName } from '../value-objects/location-name.value-object.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface BookcaseState {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

// A piece of furniture holding shelves. Its name is unique across the installation; it stays
// available without shelves or books.
export class Bookcase {
    private state: BookcaseState;

    constructor(state: BookcaseState) {
        this.state = { ...state, name: LocationName.of(state.name, 'bookcase') };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): BookcaseState {
        return { ...this.state };
    }

    // Equal keys mean equivalent names: case, accents and outer spaces are ignored.
    get key(): string {
        return NameKey.of(this.state.name);
    }

    rename(name: string, now: string): void {
        this.state.name = LocationName.of(name, 'bookcase');
        this.state.updatedAt = now;
    }
}
