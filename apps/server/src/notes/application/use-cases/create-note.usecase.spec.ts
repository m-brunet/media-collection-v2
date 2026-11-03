import { expect, it } from 'vitest';
import { CreateNote } from './create-note.usecase.js';
import { actor, clock, MemoryNotes, note } from '../testing/note-doubles.test-support.js';

it('performs its owned operation', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new CreateNote(notes, { next: () => 'created' }, clock);

    const result = await subject.execute(actor, { title: ' New ', body: 'Body' });

    expect(result.snapshot).toMatchObject({
        id: 'created',
        ownerId: actor.id,
        title: 'New',
        createdAt: clock.now().toISOString(),
    });
});
it('rejects mandatory password setup', async () => {
    const notes = new MemoryNotes();
    const subject = new CreateNote(notes, { next: () => 'created' }, clock);
    const restricted = { ...actor, mustChangePassword: true };

    const result = subject.execute(restricted, { title: ' New ', body: 'Body' });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('prevents invalid writes', async () => {
    const notes = new MemoryNotes();

    await notes.create(note());
    const subject = new CreateNote(notes, { next: () => 'created' }, clock);
    const input = { title: '', body: '' };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await notes.find(actor.id, 'note'))!.snapshot.title).toBe('Title');
});
