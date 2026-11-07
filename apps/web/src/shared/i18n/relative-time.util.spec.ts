import { describe, expect, it } from 'vitest';
import { RelativeTime } from './relative-time.util';

const now = new Date('2026-11-07T08:00:00.000Z');
const english = new RelativeTime('en-GB', 'just now', 'Europe/Paris');
const french = new RelativeTime('fr-FR', 'à l’instant', 'Europe/Paris');

describe('RelativeTime', () => {
    it('says just now under a minute', () => {
        const moment = '2026-11-07T07:59:30.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('just now');
    });
    it('counts minutes under an hour', () => {
        const moment = '2026-11-07T07:48:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('12 minutes ago');
    });
    it('counts hours on the same day', () => {
        const moment = '2026-11-07T06:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('2 hours ago');
    });
    it('says yesterday for the evening before, by calendar day in the viewer time zone', () => {
        const moment = '2026-11-06T22:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('yesterday');
    });
    it('counts days up to six days', () => {
        const moment = '2026-11-01T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('6 days ago');
    });
    it('says last week after seven days', () => {
        const moment = '2026-10-31T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('last week');
    });
    it('counts weeks up to four weeks', () => {
        const moment = '2026-10-10T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('4 weeks ago');
    });
    it('says last month after thirty days within the previous month', () => {
        const moment = '2026-10-07T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('last month');
    });
    it('counts months under a year', () => {
        const moment = '2026-05-01T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('6 months ago');
    });
    it('says last year after twelve months', () => {
        const moment = '2025-11-01T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('last year');
    });
    it('counts years', () => {
        const moment = '2023-06-01T10:00:00.000Z';

        const text = english.of(moment, now);

        expect(text).toBe('3 years ago');
    });
    it('speaks French minutes', () => {
        const moment = '2026-11-07T07:48:00.000Z';

        const text = french.of(moment, now);

        expect(text).toBe('il y a 12 minutes');
    });
    it('speaks French for yesterday', () => {
        const moment = '2026-11-06T22:00:00.000Z';

        const text = french.of(moment, now);

        expect(text).toBe('hier');
    });
    it('speaks French weeks', () => {
        const moment = '2026-10-17T10:00:00.000Z';

        const text = french.of(moment, now);

        expect(text).toBe('il y a 3 semaines');
    });
    it('speaks French for last year', () => {
        const moment = '2025-11-01T10:00:00.000Z';

        const text = french.of(moment, now);

        expect(text).toBe('l’année dernière');
    });
    it('gives the French just now', () => {
        const moment = '2026-11-07T08:00:00.000Z';

        const text = french.of(moment, now);

        expect(text).toBe('à l’instant');
    });
});
