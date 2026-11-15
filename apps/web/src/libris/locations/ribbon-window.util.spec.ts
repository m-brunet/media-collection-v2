import { describe, expect, it } from 'vitest';
import { RibbonWindow } from './ribbon-window.util';

describe('RibbonWindow places', () => {
    it('fits as many covers as the strip width allows beside the next arrow', () => {
        const places = RibbonWindow.places(968, false);

        expect(places).toBe(14);
    });

    it('gives a place to the back arrow once the strip has moved', () => {
        const places = RibbonWindow.places(968, true);

        expect(places).toBe(13);
    });

    it('keeps two places on a very narrow strip', () => {
        const places = RibbonWindow.places(40, false);

        expect(places).toBe(2);
    });

    it('assumes fourteen places before the strip is measured', () => {
        const places = RibbonWindow.places(null, false);

        expect(places).toBe(14);
    });
});

describe('RibbonWindow page', () => {
    it('shows every book when they all fit, with no tile', () => {
        const page = RibbonWindow.page(0, 968, 10);

        expect([page.count, page.more]).toEqual([10, 0]);
    });

    it('gives the last place to a tile counting the other books', () => {
        const page = RibbonWindow.page(0, 968, 58);

        expect([page.count, page.more, page.next]).toEqual([13, 45, 13]);
    });

    it('fills the last place with a book when it is the last one', () => {
        const page = RibbonWindow.page(0, 968, 14);

        expect([page.count, page.more]).toEqual([14, 0]);
    });

    it('shows one book fewer once the back arrow takes its place', () => {
        const page = RibbonWindow.page(13, 968, 58);

        expect([page.count, page.more, page.next]).toEqual([12, 33, 25]);
    });

    it('goes back to the first page from the second', () => {
        const page = RibbonWindow.page(13, 968, 58);

        expect(page.previous).toBe(0);
    });

    it('goes back by the books of a moved page further along', () => {
        const page = RibbonWindow.page(37, 968, 58);

        expect(page.previous).toBe(25);
    });

    it('stays on the shelf when it lost books since the strip moved', () => {
        const page = RibbonWindow.page(52, 968, 10);

        expect([page.start, page.count]).toEqual([9, 1]);
    });
});
