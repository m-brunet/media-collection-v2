import type { StatisticsDto } from '../../../../../packages/contracts/src/http';

export class StatisticsFormat {
    static collections({ collections }: Pick<StatisticsDto, 'collections'>): number {
        return collections.finished + collections.unfinished + collections.dropped;
    }

    static number(value: number, locale: string): string {
        return new Intl.NumberFormat(locale).format(value);
    }

    static percent(part: number, whole: number, locale: string): string {
        return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
            whole === 0 ? 0 : part / whole,
        );
    }
}
