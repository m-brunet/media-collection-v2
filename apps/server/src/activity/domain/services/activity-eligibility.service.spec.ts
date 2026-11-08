import { describe, expect, it } from 'vitest';
import { ActivityEligibility } from './activity-eligibility.service.js';

describe('ActivityEligibility', () => {
    it('includes shared book changes', () => {
        const categories = ['book.created', 'book.updated', 'book.marked-owned', 'book.deleted'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([true, true, true, true]);
    });
    it('includes location, tag and cover changes of a book and author corrections', () => {
        const categories = ['book.organised', 'book.cover-changed', 'author.corrected'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([true, true, true]);
    });
    it('includes collection changes', () => {
        const categories = [
            'collection.created',
            'collection.updated',
            'collection.finished',
            'collection.reopened',
            'collection.deleted',
            'collection.removed',
        ];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([true, true, true, true, true, true]);
    });
    it('includes bookcase, shelf and tag changes', () => {
        const categories = ['bookcase.renamed', 'shelf.moved', 'tag.created', 'tag.deleted'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([true, true, true, true]);
    });
    it('includes lending and returns', () => {
        const categories = ['loan.lent', 'loan.returned', 'receiver.created'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([true, true, true]);
    });
    it('excludes personal reading status and private note changes', () => {
        const categories = ['book.reading-status-changed', 'book.note-changed'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([false, false]);
    });
    it('excludes account, sign-in and setup events', () => {
        const categories = [
            'account.created',
            'account.password-changed',
            'account.renamed',
            'authentication.signed-in',
            'setup.administrator-created',
        ];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([false, false, false, false, false]);
    });
    it('excludes server settings and the colour scheme', () => {
        const categories = ['server-settings.http-changed', 'appearance.color-scheme-changed'];

        const included = categories.map((category) => ActivityEligibility.includes(category));

        expect(included).toEqual([false, false]);
    });
    it('excludes a category it does not know', () => {
        const category = 'book.something-new';

        const included = ActivityEligibility.includes(category);

        expect(included).toBe(false);
    });
});
