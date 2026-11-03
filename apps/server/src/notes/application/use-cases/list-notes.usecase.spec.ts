import { expect, it } from 'vitest';
import { ListNotes } from './list-notes.usecase.js';
import { actor, MemoryNotes, note } from '../testing/note-doubles.test-support.js';

it('performs its owned operation', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new ListNotes(notes);

    const result = await subject.execute(actor);

    expect(result.map((n) => n.snapshot.id)).toEqual(['note']);
});
it('rejects mandatory password setup', async () => {
    const notes = new MemoryNotes();
    const subject = new ListNotes(notes);
    const restricted = { ...actor, mustChangePassword: true };

    const result = subject.execute(restricted);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('excludes another owners notes even for administrators', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new ListNotes(notes);
    const other = { ...actor, id: 'other', role: 'admin' as const };

    const result = await subject.execute(other);

    expect(result).toEqual([]);
});
