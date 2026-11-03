import { expect, it } from 'vitest';
import { DateTimeFormatter } from './date-time-formatter.util';

const moment = '2026-11-01T12:42:00Z';

it('formats a date in English in the viewer time zone', () => {
    const formatter = new DateTimeFormatter('en-GB', 'Europe/Paris');

    const result = formatter.date(moment);

    expect(result).toBe('1 November 2026');
});

it('formats a date in French', () => {
    const formatter = new DateTimeFormatter('fr-FR', 'Europe/Paris');

    const result = formatter.date(moment);

    expect(result).toBe('1 novembre 2026');
});

it('shows the exact time in the viewer time zone with its label', () => {
    const formatter = new DateTimeFormatter('en-GB', 'Europe/Paris');

    const result = formatter.dateTime(moment);

    expect(result).toContain('13:42');
    expect(result).toMatch(/(CET|GMT\+1)$/);
});

it('converts the same moment for a viewer in another time zone', () => {
    const formatter = new DateTimeFormatter('en-GB', 'America/New_York');

    const result = formatter.dateTime(moment);

    expect(result).toContain('07:42');
});
