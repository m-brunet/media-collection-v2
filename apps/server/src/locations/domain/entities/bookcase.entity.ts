import { BookcaseSize } from '../value-objects/bookcase-size.value-object.js';
import type { BookcaseSizeName } from '../value-objects/bookcase-size.value-object.js';
import { LocationName } from '../value-objects/location-name.value-object.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export interface BookcaseState {
    id: string;
    name: string;
    size: BookcaseSizeName;
    createdAt: string;
    updatedAt: string;
}

export class Bookcase {
    private state: BookcaseState;

    constructor(state: BookcaseState) {
        this.state = {
            ...state,
            name: LocationName.of(state.name, 'bookcase'),
            size: BookcaseSize.of(state.size),
        };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): BookcaseState {
        return { ...this.state };
    }

    get key(): string {
        return NameKey.of(this.state.name);
    }

    rename(name: string, now: string): void {
        this.state.name = LocationName.of(name, 'bookcase');
        this.state.updatedAt = now;
    }

    resize(size: string, now: string): void {
        this.state.size = BookcaseSize.of(size);
        this.state.updatedAt = now;
    }
}
