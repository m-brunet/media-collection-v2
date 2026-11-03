import { expect, it } from 'vitest';
import { UpdateNote } from './update-note.usecase.js';
import { actor, clock, MemoryNotes, note } from '../testing/note-doubles.test-support.js';

it('performs its owned operation', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new UpdateNote(notes, clock);

    const result = await subject.execute(actor, 'note', { title: 'Updated', body: 'Changed' });

    expect(result.snapshot).toMatchObject({
        title: 'Updated',
        body: 'Changed',
        createdAt: note().snapshot.createdAt,
        updatedAt: clock.now().toISOString(),
    });
});
it('rejects mandatory password setup', async () => {
    const notes = new MemoryNotes();
    const subject = new UpdateNote(notes, clock);
    const restricted = { ...actor, mustChangePassword: true };

    const result = subject.execute(restricted, 'note', { title: 'Updated', body: 'Changed' });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects updating a foreign note', async () => {
    const id = 'note';
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new UpdateNote(notes, clock);
    const other = { ...actor, id: 'other', role: 'admin' as const };

    const result = subject.execute(other, id, { title: 'Updated', body: 'Changed' });

    await expect(result).rejects.toMatchObject({ code: 'not_found' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
it('rejects updating a missing note', async () => {
    const id = 'absent';
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new UpdateNote(notes, clock);
    const other = { ...actor, id: 'other', role: 'admin' as const };

    const result = subject.execute(other, id, { title: 'Updated', body: 'Changed' });

    await expect(result).rejects.toMatchObject({ code: 'not_found' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
it('prevents invalid writes', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new UpdateNote(notes, clock);
    const input = { title: '', body: '' };

    const result = subject.execute(actor, 'note', input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
