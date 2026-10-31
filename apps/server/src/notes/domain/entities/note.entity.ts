import { Failure } from '../../../shared/domain/exceptions/failure.js';

export interface NoteState {
    id: string;
    ownerId: string;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

export class Note {
    private state: NoteState;

    constructor(state: NoteState) {
        this.state = { ...state };
        this.edit(state.title, state.body, state.updatedAt);
    }

    get snapshot(): NoteState {
        return { ...this.state };
    }

    edit(title: string, body: string, updatedAt: string): void {
        const trimmed = title.trim();

        Failure.ensure(
            trimmed.length > 0 && trimmed.length <= 120,
            'A note title must contain 1–120 characters.',
        );
        Failure.ensure(body.length <= 100_000, 'A note can contain at most 100,000 characters.');
        this.state = { ...this.state, title: trimmed, body, updatedAt };
    }
}
