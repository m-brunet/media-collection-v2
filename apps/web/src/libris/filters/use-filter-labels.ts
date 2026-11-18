import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
    BookCategory,
    BookcaseDto,
    BookOwnership,
    TagDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { LocationFormat } from '../locations/location-format.util';
import type { Filter, FilterEntry } from './book-filter.util';
import { BookFilter } from './book-filter.util';
import { useChosenNames } from './use-chosen-names';

function useLoaded<T>(needed: boolean, path: string): T[] | null {
    const [loaded, setLoaded] = useState<T[] | null>(null);

    useEffect(() => {
        if (!needed) {
            return;
        }

        let current = true;

        api.request<T[]>(path).then(
            (found) => current && setLoaded(found),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [needed, path]);

    return loaded;
}

function missingLocation(bookcases: readonly BookcaseDto[], value: string): boolean {
    const [kind, id] = value.split(':');

    if (kind === 'bookcase') {
        return !bookcases.some((bookcase) => bookcase.id === id);
    }

    return kind === 'shelf' && id !== undefined && LocationFormat.of(bookcases, id) === null;
}

export function useFilterLabels(filter: Filter) {
    const { t } = useI18n();
    const tags = useLoaded<TagDto>(filter.tag.length + filter.notTag.length > 0, '/tags');
    const bookcases = useLoaded<BookcaseDto>(
        filter.location.some((value) => value !== 'none'),
        '/bookcases',
    );
    const authors = useChosenNames('author', filter.author);
    const collections = useChosenNames('collection', filter.collection);
    const label = useCallback(
        ({ key, value }: FilterEntry): string => {
            const tag = () => tags?.find((candidate) => candidate.id === value)?.name ?? '…';

            switch (key) {
                case 'category':
                    return t(BookFormat.category(value as BookCategory));
                case 'ownership':
                    return t(BookFormat.ownership(value as BookOwnership));
                case 'cover':
                    return t(value === 'with' ? 'filters.withCover' : 'filters.withoutCover');
                case 'price':
                    return t(value === 'with' ? 'filters.withPrice' : 'filters.withoutPrice');
                case 'reading':
                    return t(BookFormat.reading(value === 'read'));
                case 'author':
                    return authors?.get(value) ?? t('filters.someAuthor');
                case 'publisher':
                    return value;
                case 'noPublisher':
                    return t('filters.noPublisher');
                case 'collection':
                    return value === 'none'
                        ? t('filters.noCollection')
                        : (collections?.get(value) ?? t('filters.someCollection'));
                case 'location':
                    return LocationFormat.choice(bookcases ?? [], value) ?? t('filters.noLocation');
                case 'tag':
                    return t('filters.include', { name: tag() });
                case 'notTag':
                    return t('filters.exclude', { name: tag() });
                case 'dropped':
                    return t('filters.dropped');
            }
        },
        [t, tags, bookcases, authors, collections],
    );
    const unavailable = useMemo(
        () =>
            BookFilter.entries(filter).filter(({ key, value }) => {
                switch (key) {
                    case 'tag':
                    case 'notTag':
                        return tags !== null && !tags.some((tag) => tag.id === value);
                    case 'location':
                        return (
                            value !== 'none' &&
                            bookcases !== null &&
                            missingLocation(bookcases, value)
                        );
                    case 'author':
                        return authors !== null && !authors.has(value);
                    case 'collection':
                        return value !== 'none' && collections !== null && !collections.has(value);
                    default:
                        return false;
                }
            }),
        [filter, tags, bookcases, authors, collections],
    );

    return { label, unavailable };
}
