import { expect, it } from 'vitest';
import {
    MemoryAppearanceStore,
    MemoryIconSetStore,
} from '../testing/appearance-doubles.test-support.js';
import { ColorScheme } from '../../domain/value-objects/color-scheme.value-object.js';
import { IconSet } from '../../domain/value-objects/icon-set.value-object.js';
import { ReadAppearance } from './read-appearance.usecase.js';

it('reports Spring green and Lucide before anything was chosen', async () => {
    const subject = new ReadAppearance(new MemoryAppearanceStore(), new MemoryIconSetStore());

    const result = await subject.execute();

    expect(result).toEqual({ colorScheme: 'spring-green', iconSet: 'lucide' });
});

it('reports the saved colour scheme', async () => {
    const store = new MemoryAppearanceStore();

    await store.save(new ColorScheme('rose-noir'));

    const result = await new ReadAppearance(store, new MemoryIconSetStore()).execute();

    expect(result.colorScheme).toBe('rose-noir');
});

it('reports the saved icon set', async () => {
    const sets = new MemoryIconSetStore();

    await sets.save(new IconSet('hand-inked-editorial'));

    const result = await new ReadAppearance(new MemoryAppearanceStore(), sets).execute();

    expect(result.iconSet).toBe('hand-inked-editorial');
});
