import type { BookListItemDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';

export function useBookStatus() {
    const { t } = useI18n();

    return (book: BookListItemDto) =>
        book.loan
            ? t('columns.lentTo', { name: book.loan.receiverName })
            : [
                  t(BookFormat.ownership(book.ownership)),
                  ...(book.read ? [t('status.read')] : []),
              ].join(' · ');
}
