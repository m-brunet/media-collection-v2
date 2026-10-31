import type { Note } from '../../../domain/entities/note.entity.js';

export interface NoteWriter {
    // Reject duplicate IDs without replacing existing data. All writes are owner-scoped.
    create(note: Note): Promise<void>;
    save(note: Note): Promise<boolean>;
    delete(ownerId: string, id: string): Promise<boolean>;
}
