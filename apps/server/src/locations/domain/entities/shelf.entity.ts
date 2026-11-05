import { LocationName } from '../value-objects/location-name.value-object.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface ShelfState {
    id: string;
    bookcaseId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}

// A shelf inside a bookcase, where books are kept. Its name is unique within its bookcase; it
// can move to another bookcase with its books.
export class Shelf {
    private state: ShelfState;

    constructor(state: ShelfState) {
        this.state = { ...state, name: LocationName.of(state.name, 'shelf') };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): ShelfState {
        return { ...this.state };
    }

    // Equal keys mean equivalent names: case, accents and outer spaces are ignored.
    get key(): string {
        return NameKey.of(this.state.name);
    }

    rename(name: string, now: string): void {
        this.state.name = LocationName.of(name, 'shelf');
        this.state.updatedAt = now;
    }

    moveTo(bookcaseId: string, now: string): void {
        this.state.bookcaseId = bookcaseId;
        this.state.updatedAt = now;
    }
}
