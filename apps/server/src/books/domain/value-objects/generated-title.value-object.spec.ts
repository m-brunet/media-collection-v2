import { expect, it } from 'vitest';
import { GeneratedTitle } from './generated-title.value-object.js';

it('names a single volume after its collection', () => {
    const name = 'Gunnm';

    const result = GeneratedTitle.of(name, 3, 3);

    expect(result.text).toBe('Gunnm Vol. 3');
});

it('names a consecutive range with an en dash', () => {
    const name = 'Saga';

    const result = GeneratedTitle.of(name, 1, 3);

    expect(result.text).toBe('Saga Vol. 1–3');
});

it('names volume 0 like any other volume', () => {
    const name = 'Gunnm';

    const result = GeneratedTitle.of(name, 0, 0);

    expect(result.text).toBe('Gunnm Vol. 0');
});

it('keeps the display spelling of the collection name, without its outer spaces', () => {
    const name = '  Ranma ½ ';

    const result = GeneratedTitle.of(name, 12, 12);

    expect(result.text).toBe('Ranma ½ Vol. 12');
});

it('fits the title limit for the longest collection name and range', () => {
    const name = 'x'.repeat(200);

    const result = GeneratedTitle.of(name, 9998, 9999);

    expect(result.text.length).toBeLessThanOrEqual(300);
});
