import { describe, expect, it } from 'vitest';
import { ValueProviders } from './value-providers.helper.js';

describe('ValueProviders', () => {
    it('registers each dependency under its token', () => {
        const clock = { now: () => new Date() };
        const ids = { next: () => 'id-1' };

        const providers = ValueProviders.of(
            { clock, ids },
            { clock: 'TAGS_CLOCK', ids: 'TAGS_IDS' },
        );

        expect(providers).toEqual([
            { provide: 'TAGS_CLOCK', useValue: clock },
            { provide: 'TAGS_IDS', useValue: ids },
        ]);
    });
    it('ignores tokens without a dependency', () => {
        const clock = { now: () => new Date() };
        const tokens = { clock: 'TAGS_CLOCK', loader: 'TAGS_LOADER' };

        const providers = ValueProviders.of({ clock }, tokens);

        expect(providers).toEqual([{ provide: 'TAGS_CLOCK', useValue: clock }]);
    });
});
