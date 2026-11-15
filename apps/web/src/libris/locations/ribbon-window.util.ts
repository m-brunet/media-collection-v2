import { RibbonSizes } from './ribbon-sizes';

export interface RibbonPage {
    start: number;
    count: number;
    more: number;
    next: number;
    previous: number;
}

export class RibbonWindow {
    static places(width: number | null, moved: boolean): number {
        if (width === null) {
            return RibbonSizes.placesBeforeMeasure - (moved ? 1 : 0);
        }

        const arrows = (moved ? 2 : 1) * (RibbonSizes.arrowWidth + RibbonSizes.coverGap);

        return Math.max(
            2,
            Math.floor(
                (width - arrows + RibbonSizes.coverGap) /
                    (RibbonSizes.coverWidth + RibbonSizes.coverGap),
            ),
        );
    }

    static page(start: number, width: number | null, total: number): RibbonPage {
        const first = Math.max(0, Math.min(start, total - 1));
        const places = RibbonWindow.places(width, first > 0);
        const count = first + places >= total ? total - first : places - 1;
        const firstPage = RibbonWindow.places(width, false) - 1;

        return {
            start: first,
            count,
            more: total - first - count,
            next: first + count,
            previous: first <= firstPage ? 0 : first - (RibbonWindow.places(width, true) - 1),
        };
    }
}
