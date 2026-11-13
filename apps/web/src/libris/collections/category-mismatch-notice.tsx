import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { CategoryMismatchDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Notice } from '../../shared/ui/notice';

export function CategoryMismatchNotice({
    collectionId = null,
    version = 0,
}: {
    collectionId?: string | null;
    version?: number;
}) {
    const { t } = useI18n();
    const [mismatches, setMismatches] = useState<CategoryMismatchDto[]>([]);
    const address =
        '/collections/mismatches' +
        (collectionId ? '?collection=' + encodeURIComponent(collectionId) : '');

    useEffect(() => {
        let current = true;

        api.request<CategoryMismatchDto[]>(address).then(
            (result) => current && setMismatches(result),
            () => current && setMismatches([]),
        );

        return () => {
            current = false;
        };
    }, [address, version]);

    if (mismatches.length === 0) {
        return null;
    }

    return (
        <Notice tone="warning">
            <details className="mismatch-notice">
                <summary>
                    {mismatches.length === 1
                        ? t('mismatches.summaryOne')
                        : t('mismatches.summary', { count: mismatches.length })}
                </summary>
                <p className="muted">{t('mismatches.hint')}</p>
                <ul className="mismatch-notice__list">
                    {mismatches.map((mismatch) => (
                        <li key={mismatch.bookId}>
                            <Link to={'/books/' + mismatch.bookId}>{mismatch.title}</Link>{' '}
                            <span className="muted">
                                {t('mismatches.line', {
                                    category: t(BookFormat.category(mismatch.category)),
                                    collection: mismatch.collectionName,
                                    collectionCategory: t(
                                        BookFormat.category(mismatch.collectionCategory),
                                    ),
                                })}
                            </span>
                        </li>
                    ))}
                </ul>
            </details>
        </Notice>
    );
}
