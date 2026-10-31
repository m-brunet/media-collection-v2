import { randomUUID } from 'node:crypto';
import { Note } from '../../../apps/server/src/notes/domain/entities/note.entity.js';
import type { ApiFixture } from '../setup/fixture.js';
import type { TestAppContext } from '../setup/test-app-context.js';

export class NoteFixture implements ApiFixture {
    readonly entity: Note;

    constructor(ownerId: string, input: { id?: string; title?: string; body?: string } = {}) {
        this.entity = new Note({
            id: input.id ?? randomUUID(),
            ownerId,
            title: input.title ?? 'Private note',
            body: input.body ?? 'Fixture content',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });
    }

    async save(context: Pick<TestAppContext, 'notes'>): Promise<void> {
        await context.notes.create(this.entity);
    }

    getId(): string {
        return this.entity.snapshot.id;
    }
}
