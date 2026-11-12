import { expect, it } from 'vitest';
import { ApplicationLabel } from './application-label.util.js';

it('keeps the name of the installed application', () => {
    const label = new ApplicationLabel(true);

    const result = label.of('Libris');

    expect(result).toBe('Libris');
});
it('marks the name of the application run from source', () => {
    const label = new ApplicationLabel(false);

    const result = label.of('Libris');

    expect(result).toBe('Libris (dev)');
});
