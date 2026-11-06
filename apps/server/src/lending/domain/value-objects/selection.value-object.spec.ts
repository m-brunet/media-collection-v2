import { expect, it } from 'vitest';
import { Selection } from './selection.value-object.js';

it('keeps a single selected book', () => {
    const ids = ['piranesi'];

    const selection = Selection.of(ids);

    expect(selection.ids).toEqual(['piranesi']);
});

it('keeps several selected books in their order', () => {
    const ids = ['piranesi', 'dune', 'overstory'];

    const selection = Selection.of(ids);

    expect(selection.ids).toEqual(['piranesi', 'dune', 'overstory']);
});

it('refuses an empty selection', () => {
    const ids: string[] = [];

    const operation = () => Selection.of(ids);

    expect(operation).toThrow(expect.objectContaining({ reason: 'selection-empty' }));
});

it('refuses a book selected twice', () => {
    const ids = ['dune', 'piranesi', 'dune'];

    const operation = () => Selection.of(ids);

    expect(operation).toThrow(expect.objectContaining({ reason: 'selection-duplicate' }));
});

it('does not change when the given list changes afterwards', () => {
    const ids = ['dune'];
    const selection = Selection.of(ids);

    ids.push('piranesi');

    expect(selection.ids).toEqual(['dune']);
});
