import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { ChartSegment } from './chart-segment';
import { StatisticsFormat } from './statistics-format.util';

const categories: readonly BookCategory[] = ['books', 'manga', 'comics'];
const categoryColors: Record<BookCategory, string> = {
    books: 'var(--color-chart-1)',
    manga: 'var(--color-chart-2)',
    comics: 'var(--color-chart-3)',
};

export function useStatisticsSegments(statistics: StatisticsDto, category: BookCategory | null) {
    const { t, locale } = useI18n();
    const shared = (value: number, total: number) =>
        StatisticsFormat.number(value, locale) +
        ' · ' +
        StatisticsFormat.percent(value, total, locale);
    const library = categories.reduce((sum, value) => sum + statistics.categories[value], 0);
    const owned = statistics.reading ? statistics.reading.read + statistics.reading.notRead : 0;

    return {
        library,
        categories: [...categories]
            .sort((a, b) => statistics.categories[b] - statistics.categories[a])
            .map((value): ChartSegment => ({
                key: value,
                label: t(`category.${value}`),
                value: statistics.categories[value],
                detail: shared(statistics.categories[value], library),
                color: categoryColors[value],
                dimmed: category !== null && category !== value,
            })),
        reading: statistics.reading
            ? [
                  {
                      key: 'read',
                      label: t('status.read'),
                      value: statistics.reading.read,
                      detail: shared(statistics.reading.read, owned),
                      color: 'var(--color-chart-1)',
                  },
                  {
                      key: 'not-read',
                      label: t('status.notRead'),
                      value: statistics.reading.notRead,
                      detail: shared(statistics.reading.notRead, owned),
                      color: 'var(--color-chart-track)',
                  },
              ]
            : [],
        collections: [
            {
                key: 'finished',
                label: t('statistics.finished'),
                value: statistics.collections.finished,
                detail: StatisticsFormat.number(statistics.collections.finished, locale),
                color: 'var(--color-chart-1)',
            },
            {
                key: 'unfinished',
                label: t('statistics.unfinished'),
                value: statistics.collections.unfinished,
                detail: StatisticsFormat.number(statistics.collections.unfinished, locale),
                color: 'var(--color-chart-2)',
            },
            ...(statistics.collections.dropped > 0
                ? [
                      {
                          key: 'dropped',
                          label: t('statistics.dropped'),
                          value: statistics.collections.dropped,
                          detail: StatisticsFormat.number(statistics.collections.dropped, locale),
                          color: 'var(--color-chart-track)',
                      },
                  ]
                : []),
        ],
    };
}
