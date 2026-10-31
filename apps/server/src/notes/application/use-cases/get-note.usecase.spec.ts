import { expect, it } from 'vitest';
import { GetNote } from './get-note.usecase.js';
import { actor, MemoryNotes, note } from '../testing/note-doubles.test-support.js';

it('performs its owned operation', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new GetNote(notes);

    const result = await subject.execute(actor, 'note');

    expect(result.snapshot.body).toBe('Text');
});
it('rejects mandatory password setup', async () => {
    const notes = new MemoryNotes();
    const subject = new GetNote(notes);
    const restricted = { ...actor, mustChangePassword: true };

    const result = subject.execute(restricted, 'note');

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects reading a foreign note', async () => {
    const id = 'note';
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new GetNote(notes);
    const other = { ...actor, id: 'other', role: 'admin' as const };

    const result = subject.execute(other, id);

    await expect(result).rejects.toMatchObject({ code: 'not_found' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
it('rejects reading a missing note', async () => {
    const id = 'absent';
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new GetNote(notes);
    const other = { ...actor, id: 'other', role: 'admin' as const };

    const result = subject.execute(other, id);

    await expect(result).rejects.toMatchObject({ code: 'not_found' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
