import { useI18n } from '../../shared/i18n/i18n-context';

export function useLocationCounts() {
    const { t, locale } = useI18n();
    const number = new Intl.NumberFormat(locale);

    return {
        bookcases: (count: number) =>
            count === 1
                ? t('bookshelves.bookcasesOne')
                : t('bookshelves.bookcasesMany', { count: number.format(count) }),
        shelves: (count: number) =>
            count === 1
                ? t('bookshelves.shelvesOne')
                : t('bookshelves.shelvesMany', { count: number.format(count) }),
        books: (count: number) =>
            count === 1
                ? t('bookshelves.booksOne')
                : t('bookshelves.booksMany', { count: number.format(count) }),
    };
}
