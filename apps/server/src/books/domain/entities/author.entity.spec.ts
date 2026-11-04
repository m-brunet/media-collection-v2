import { expect, it } from 'vitest';
import { Author } from './author.entity.js';

const state = { id: 'clarke', name: ' Susanna Clarke ', createdAt: '2026-01-01T00:00:00Z' };

it('keeps the spelling of the name without outer spaces', () => {
    const input = { ...state };

    const author = new Author(input);

    expect(author.snapshot.name).toBe('Susanna Clarke');
});

it('compares names ignoring case and accents', () => {
    const author = new Author({ ...state, name: 'Hervé Bazin' });

    const result = author.key;

    expect(result).toBe('herve bazin');
});

it('corrects the shared name', () => {
    const author = new Author(state);

    author.correct('Susanna M. Clarke');

    expect(author.snapshot.name).toBe('Susanna M. Clarke');
});

it('rejects an empty name', () => {
    const input = { ...state, name: '   ' };

    const operation = () => new Author(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'author-name-invalid' }));
});
