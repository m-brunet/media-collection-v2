import { describe, expect, it } from 'vitest';
import type { ActivityOperation } from './activity-projection.service.js';
import { ActivityTimeline } from './activity-timeline.service.js';

function operation(
    id: string,
    occurredAt: string,
    category: string,
    overrides: { actorId?: string | null; subjectId?: string } = {},
): ActivityOperation {
    return {
        id,
        occurredAt,
        actorId: overrides.actorId === undefined ? 'user-alex' : overrides.actorId,
        actor: 'Alex',
        records: [
            {
                category,
                subjectId: overrides.subjectId ?? 'book-dune',
                before: null,
                after: { title: 'Dune', name: 'Fantasy' },
                currentTitle: null,
            },
        ],
    };
}

function ids(operations: ActivityOperation[]): string[] {
    return ActivityTimeline.of(operations).map((entry) => entry.id);
}

describe('ActivityTimeline', () => {
    it('keeps operations newest first, one entry each', () => {
        const operations = [
            operation('tag', '2026-11-01T12:10:00.000Z', 'tag.created'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['tag', 'book']);
    });
    it('joins a cover change to the creation of the same book just before it', () => {
        const operations = [
            operation('cover', '2026-11-01T12:00:01.000Z', 'book.cover-changed'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['book']);
    });
    it('joins a cover change to an update of the same book two minutes before it', () => {
        const operations = [
            operation('cover', '2026-11-01T12:02:00.000Z', 'book.cover-changed'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.updated'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['book']);
    });
    it('joins a cover change across a personal change made in between', () => {
        const operations = [
            operation('cover', '2026-11-01T12:00:02.000Z', 'book.cover-changed'),
            operation('reading', '2026-11-01T12:00:01.000Z', 'book.reading-status-changed'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['book']);
    });
    it('keeps a cover change made more than two minutes after the save', () => {
        const operations = [
            operation('cover', '2026-11-01T12:02:01.000Z', 'book.cover-changed'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['cover', 'book']);
    });
    it('keeps a cover change made by another account', () => {
        const operations = [
            operation('cover', '2026-11-01T12:00:01.000Z', 'book.cover-changed', {
                actorId: 'user-sam',
            }),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['cover', 'book']);
    });
    it('keeps a cover change of another book', () => {
        const operations = [
            operation('cover', '2026-11-01T12:00:01.000Z', 'book.cover-changed', {
                subjectId: 'book-emma',
            }),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['cover', 'book']);
    });
    it('keeps a cover change after a location change of the same book', () => {
        const operations = [
            operation('cover', '2026-11-01T12:00:01.000Z', 'book.cover-changed'),
            operation('organised', '2026-11-01T12:00:00.000Z', 'book.organised'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['cover', 'organised']);
    });
    it('keeps a cover change on its own', () => {
        const operations = [operation('cover', '2026-11-01T12:00:01.000Z', 'book.cover-changed')];

        const result = ids(operations);

        expect(result).toEqual(['cover']);
    });
    it('leaves out operations with nothing to describe', () => {
        const operations = [
            operation('note', '2026-11-01T12:00:01.000Z', 'book.note-changed'),
            operation('book', '2026-11-01T12:00:00.000Z', 'book.created'),
        ];

        const result = ids(operations);

        expect(result).toEqual(['book']);
    });
});
