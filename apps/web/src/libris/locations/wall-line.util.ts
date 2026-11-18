import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { WallDrawing } from './wall-drawing.util';
import { WallSizes } from './wall-sizes';

export class WallLine {
    private readonly widths: number[];
    private readonly lefts: number[];

    constructor(
        bookcases: readonly BookcaseDto[],
        scale: number,
        private readonly room: number | null,
    ) {
        this.widths = bookcases.map((bookcase) =>
            Math.round(WallDrawing.width(bookcase.size) * scale + 2 * WallSizes.linePadding),
        );
        this.lefts = this.widths.map((_, position) =>
            this.widths
                .slice(0, position)
                .reduce((total, width) => total + width + WallSizes.lineGap, 0),
        );
    }

    static scale(roomHeight: number | null, mostShelves: number): number {
        if (roomHeight === null) {
            return 1;
        }

        const fitting = (roomHeight - WallSizes.lineChrome) / WallDrawing.height(mostShelves);

        return Math.min(1, Math.max(WallSizes.lineMinScale, fitting));
    }

    static minimumHeight(bookcases: readonly BookcaseDto[]): number {
        const mostShelves = Math.max(0, ...bookcases.map((bookcase) => bookcase.shelves.length));

        return Math.ceil(
            WallSizes.lineChrome + WallDrawing.height(mostShelves) * WallSizes.lineMinScale,
        );
    }

    static columns(width: number | null): number {
        if (width === null) {
            return WallSizes.panelColumns;
        }

        return Math.max(
            3,
            Math.floor(
                (width + WallSizes.coverGap) / (WallSizes.coverMinWidth + WallSizes.coverGap),
            ),
        );
    }

    width(position: number): number {
        return this.widths[position] ?? 0;
    }

    offset(start: number): number {
        return this.lefts[start] ?? 0;
    }

    overflows(): boolean {
        return this.room !== null && this.total() > this.room;
    }

    lastStart(): number {
        if (this.room === null || !this.overflows()) {
            return 0;
        }

        const room = this.room;
        const fitting = this.lefts.findIndex((left) => this.total() - left <= room);

        return fitting < 0 ? this.lefts.length - 1 : fitting;
    }

    shown(position: number, start: number): boolean {
        if (this.room === null) {
            return true;
        }

        const left = this.offset(position) - this.offset(start);

        return left < this.room && left + this.width(position) > 0;
    }

    fullyShown(position: number, start: number): boolean {
        if (this.room === null) {
            return true;
        }

        const left = this.offset(position) - this.offset(start);

        return left >= 0 && left + this.width(position) <= this.room;
    }

    private total(): number {
        const last = this.widths.length - 1;

        return last < 0 ? 0 : this.offset(last) + this.width(last);
    }
}
