import { RibbonSizes } from './ribbon-sizes';

export interface RibbonPage {
    start: number;
    count: number;
    more: number;
    step: number;
}

export class RibbonWindow {
    static places(width: number | null): number {
        if (width === null) {
            return RibbonSizes.placesBeforeMeasure;
        }

        const arrows = 2 * (RibbonSizes.arrowWidth + RibbonSizes.coverGap);

        return Math.max(
            2,
            Math.floor(
                (width - arrows + RibbonSizes.coverGap) /
                    (RibbonSizes.coverWidth + RibbonSizes.coverGap),
            ),
        );
    }

    static page(start: number, places: number, total: number): RibbonPage {
        const step = places - 1;
        const first = Math.max(0, Math.min(start, total - 1));
        const count = first + places >= total ? total - first : step;

        return { start: first, count, more: total - first - count, step };
    }
}
