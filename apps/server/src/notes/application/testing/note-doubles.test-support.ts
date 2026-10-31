import { Note } from '../../domain/entities/note.entity.js';
import type { NoteRepository } from '../ports/driven/note-repository.interface.js';

export class MemoryNotes implements NoteRepository {
    readonly notes = new Map<string, Note>();

    async list(owner: string) {
        return [...this.notes.values()]
            .filter((note) => note.snapshot.ownerId === owner)
            .map((note) => new Note(note.snapshot));
    }

    async find(owner: string, id: string) {
        const note = this.notes.get(id);

        return note?.snapshot.ownerId === owner ? new Note(note.snapshot) : null;
    }

    async create(note: Note) {
        if (this.notes.has(note.snapshot.id)) {
            throw new Error('The note ID already exists.');
        }

        this.notes.set(note.snapshot.id, new Note(note.snapshot));
    }

    async save(note: Note) {
        if (!(await this.find(note.snapshot.ownerId, note.snapshot.id))) {
            return false;
        }

        this.notes.set(note.snapshot.id, new Note(note.snapshot));

        return true;
    }

    async delete(owner: string, id: string) {
        if (!(await this.find(owner, id))) {
            return false;
        }

        return this.notes.delete(id);
    }
}

export const actor = {
    id: 'owner',
    username: 'owner',
    role: 'user' as const,
    mustChangePassword: false,
};
export const clock = { now: () => new Date('2026-01-02T00:00:00Z') };

export function note() {
    return new Note({
        id: 'note',
        ownerId: actor.id,
        title: 'Title',
        body: 'Text',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });
}
