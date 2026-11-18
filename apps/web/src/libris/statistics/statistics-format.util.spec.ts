import { expect, it } from 'vitest';
import { StatisticsFormat } from './statistics-format.util';

it('groups the digits of a number for the interface language', () => {
    const text = StatisticsFormat.number(96420, 'en-GB');

    expect(text).toBe('96,420');
});
it('rounds a share to a whole percent', () => {
    const text = StatisticsFormat.percent(312, 450, 'en-GB');

    expect(text).toBe('69%');
});
it('counts every collection whatever its status', () => {
    const collections = { finished: 2, unfinished: 3, dropped: 1, missingVolumes: 9 };

    const total = StatisticsFormat.collections({ collections });

    expect(total).toBe(6);
});
it('gives no share of nothing', () => {
    const text = StatisticsFormat.percent(0, 0, 'fr-FR');

    expect(text).toBe('0 %');
});
