import { describe, expect, it } from 'vitest';
import {
    additions,
    administrator,
    guest,
    InMemoryActivityRecords,
    operationAt,
    owner,
    temporaryOwner,
} from '../testing/activity-doubles.test-support.js';
import { ActivityEligibility } from '../../domain/services/activity-eligibility.service.js';
import { ListActivity } from './list-activity.usecase.js';

describe('ListActivity', () => {
    it('lists entries newest first', async () => {
        const records = new InMemoryActivityRecords(additions(3));

        const page = await new ListActivity(records).execute(owner, null);

        expect(page.entries.map((entry) => entry.event)).toEqual([
            { kind: 'book-added', title: 'Book 2' },
            { kind: 'book-added', title: 'Book 1' },
            { kind: 'book-added', title: 'Book 0' },
        ]);
        expect(page.older).toBeNull();
    });
    it('asks only for the eligible categories', async () => {
        const records = new InMemoryActivityRecords();

        await new ListActivity(records).execute(owner, null);

        expect(records.queries[0]?.categories).toEqual(ActivityEligibility.categories);
    });
    it('leaves out personal and account events', async () => {
        const records = new InMemoryActivityRecords([
            operationAt(2, 'account.password-changed', {}),
            operationAt(1, 'book.reading-status-changed', { read: true }),
            operationAt(0, 'tag.created', { name: 'Fantasy' }),
        ]);

        const page = await new ListActivity(records).execute(owner, null);

        expect(page.entries.map((entry) => entry.event)).toEqual([
            { kind: 'tag-created', name: 'Fantasy' },
        ]);
    });
    it('shows twenty entries and where older ones continue', async () => {
        const records = new InMemoryActivityRecords(additions(25));

        const page = await new ListActivity(records).execute(owner, null);

        expect(page.entries).toHaveLength(20);
        expect(page.entries.at(-1)?.event).toEqual({ kind: 'book-added', title: 'Book 5' });
        expect(page.older).toEqual({
            occurredAt: '2026-11-01T10:05:00.000Z',
            operationId: 'operation-0005',
        });
    });
    it('has nothing older after exactly twenty entries', async () => {
        const records = new InMemoryActivityRecords(additions(20));

        const page = await new ListActivity(records).execute(owner, null);

        expect(page.entries).toHaveLength(20);
        expect(page.older).toBeNull();
    });
    it('continues after the given cursor', async () => {
        const records = new InMemoryActivityRecords(additions(25));

        const page = await new ListActivity(records).execute(owner, {
            occurredAt: '2026-11-01T10:05:00.000Z',
            operationId: 'operation-0005',
        });

        expect(page.entries.map((entry) => entry.id)).toEqual([
            'operation-0004',
            'operation-0003',
            'operation-0002',
            'operation-0001',
            'operation-0000',
        ]);
        expect(page.older).toBeNull();
    });
    it('does not count a cover change joined to its save toward the page', async () => {
        const save = operationAt(0, 'book.created', { title: 'Dune' });
        const cover = operationAt(1, 'book.cover-changed', { title: 'Dune', hasCover: true });
        const records = new InMemoryActivityRecords([
            { ...save, records: [{ ...save.records[0]!, subjectId: 'book-dune' }] },
            { ...cover, records: [{ ...cover.records[0]!, subjectId: 'book-dune' }] },
            ...additions(19, 2),
        ]);

        const page = await new ListActivity(records).execute(owner, null);

        expect(page.entries).toHaveLength(20);
        expect(page.entries.map((entry) => entry.id)).not.toContain('operation-0001');
        expect(page.older).toBeNull();
    });
    it('names the acting account on each entry', async () => {
        const records = new InMemoryActivityRecords([
            operationAt(0, 'tag.created', { name: 'Fantasy' }, { actor: 'Camille' }),
        ]);

        const page = await new ListActivity(records).execute(administrator, null);

        expect(page.entries[0]?.actor).toBe('Camille');
    });
    it('shows Activity to a Guest', async () => {
        const records = new InMemoryActivityRecords(additions(1));

        const page = await new ListActivity(records).execute(guest, null);

        expect(page.entries).toHaveLength(1);
    });
    it('refuses an account that must replace its temporary password', async () => {
        const records = new InMemoryActivityRecords(additions(1));

        const listing = new ListActivity(records).execute(temporaryOwner, null);

        await expect(listing).rejects.toMatchObject({ code: 'forbidden' });
    });
});
