import type { CSSProperties } from 'react';
import type { BookcaseSize } from '../../../../../packages/contracts/src/http';
import { WallSizes } from './wall-sizes';

export class WallDrawing {
    static width(size: BookcaseSize): number {
        return (
            WallSizes.shelfNameWidth +
            WallSizes.shelfGap +
            WallSizes.bayWidths[size] +
            2 * WallSizes.bayBorder
        );
    }

    static height(shelves: number): number {
        return Math.max(1, shelves) * WallSizes.bayHeight + WallSizes.bayBorder;
    }

    static styles(size: BookcaseSize): CSSProperties {
        return {
            '--wall-bay-width': WallSizes.bayWidths[size] + 'px',
            '--wall-bay-height': WallSizes.bayHeight + 'px',
            '--wall-bay-border': WallSizes.bayBorder + 'px',
            '--wall-name-width': WallSizes.shelfNameWidth + 'px',
            '--wall-shelf-gap': WallSizes.shelfGap + 'px',
            '--wall-back-lift': WallSizes.backRowLift + 'px',
            '--wall-back-shift': WallSizes.backRowShift + 'px',
            '--wall-drawing-width': WallDrawing.width(size) + 'px',
        } as CSSProperties;
    }
}
