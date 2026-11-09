import { expect, it } from 'vitest';
import { MemoryAppearanceStore } from '../testing/appearance-doubles.test-support.js';
import { ColorScheme } from '../../domain/value-objects/color-scheme.value-object.js';
import { ReadAppearance } from './read-appearance.usecase.js';

it('reports Spring green before anything was chosen', async () => {
    const subject = new ReadAppearance(new MemoryAppearanceStore());

    const result = await subject.execute();

    expect(result).toEqual({ colorScheme: 'spring-green' });
});

it('reports the saved colour scheme', async () => {
    const store = new MemoryAppearanceStore();

    await store.save(new ColorScheme('rose-noir'));

    const result = await new ReadAppearance(store).execute();

    expect(result).toEqual({ colorScheme: 'rose-noir' });
});
