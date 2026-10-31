import type { Note } from '../../../domain/entities/note.entity.js';

export interface NoteReader {
    // Foreign IDs behave as absent; all reads are scoped to the authenticated owner.
    list(ownerId: string): Promise<Note[]>;
    find(ownerId: string, id: string): Promise<Note | null>;
}
