import { describe, expect, it } from 'vitest';
import { RibbonWindow } from './ribbon-window.util';

describe('RibbonWindow places', () => {
    it('fits as many covers as the strip width allows, beside both arrows', () => {
        const places = RibbonWindow.places(950);

        expect(places).toBe(13);
    });

    it('keeps two places on a very narrow strip', () => {
        const places = RibbonWindow.places(40);

        expect(places).toBe(2);
    });

    it('assumes thirteen places before the strip is measured', () => {
        const places = RibbonWindow.places(null);

        expect(places).toBe(13);
    });
});

describe('RibbonWindow page', () => {
    it('shows every book when they all fit, with no tile', () => {
        const page = RibbonWindow.page(0, 14, 10);

        expect(page).toEqual({ start: 0, count: 10, more: 0, step: 13 });
    });

    it('gives the last place to a tile counting the other books', () => {
        const page = RibbonWindow.page(0, 14, 58);

        expect(page).toEqual({ start: 0, count: 13, more: 45, step: 13 });
    });

    it('fills the last place with a book when it is the last one', () => {
        const page = RibbonWindow.page(0, 14, 14);

        expect([page.count, page.more]).toEqual([14, 0]);
    });

    it('shows the end of the shelf after moving along it', () => {
        const page = RibbonWindow.page(52, 14, 58);

        expect([page.count, page.more]).toEqual([6, 0]);
    });

    it('stays on the shelf when it lost books since the strip moved', () => {
        const page = RibbonWindow.page(52, 14, 10);

        expect([page.start, page.count]).toEqual([9, 1]);
    });
});
