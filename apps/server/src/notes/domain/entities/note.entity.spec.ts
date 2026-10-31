import { expect, it } from 'vitest';
import { Note } from './note.entity.js';

const state = {
    id: 'note',
    ownerId: 'owner',
    title: ' Title ',
    body: 'Text',
    createdAt: 'initial',
    updatedAt: 'initial',
};

it('normalizes the title at construction', () => {
    const input = { ...state };

    const note = new Note(input);

    expect(note.snapshot.title).toBe('Title');
});
it('rejects creation with an empty title', () => {
    const input = { title: ' ', body: '' };
    const candidate = { ...state, ...input };

    const operation = () => new Note(candidate);

    expect(operation).toThrow();
});
it('rejects creation with an overlong title', () => {
    const input = { title: 'x'.repeat(121), body: '' };
    const candidate = { ...state, ...input };

    const operation = () => new Note(candidate);

    expect(operation).toThrow();
});
it('rejects creation with an overlong body', () => {
    const input = { title: 'Valid', body: 'x'.repeat(100001) };
    const candidate = { ...state, ...input };

    const operation = () => new Note(candidate);

    expect(operation).toThrow();
});
it('rejects editing to an empty title', () => {
    const input = { title: ' ', body: '' };
    const note = new Note(state);

    const operation = () => note.edit(input.title, input.body, 'later');

    expect(operation).toThrow();
    expect(note.snapshot.title).toBe('Title');
});
it('rejects editing to an overlong title', () => {
    const input = { title: 'x'.repeat(121), body: '' };
    const note = new Note(state);

    const operation = () => note.edit(input.title, input.body, 'later');

    expect(operation).toThrow();
    expect(note.snapshot.title).toBe('Title');
});
it('rejects editing to an overlong body', () => {
    const input = { title: 'Valid', body: 'x'.repeat(100001) };
    const note = new Note(state);

    const operation = () => note.edit(input.title, input.body, 'later');

    expect(operation).toThrow();
    expect(note.snapshot.title).toBe('Title');
});
it('updates content while preserving ownership and creation time', () => {
    const note = new Note(state);

    note.edit(' Updated ', 'New text', 'later');

    expect(note.snapshot).toEqual({
        ...state,
        title: 'Updated',
        body: 'New text',
        updatedAt: 'later',
    });
});
it('returns independent snapshot state', () => {
    const note = new Note(state);
    const snapshot = note.snapshot;

    snapshot.title = 'Tampered';

    expect(note.snapshot.title).toBe('Title');
});
