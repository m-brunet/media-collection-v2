import { useCallback, useEffect, useState } from 'react';
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
import { useChosenNames } from './use-chosen-names';

export function useFilterLabels(filter: Filter) {
    const { t } = useI18n();
    const [tags, setTags] = useState<TagDto[]>([]);
    const [bookcases, setBookcases] = useState<BookcaseDto[]>([]);
    const needsTags = filter.tag.length + filter.notTag.length > 0;
    const needsLocations = filter.location.some((value) => value !== 'none');
    const authors = useChosenNames('author', filter.author);
    const collections = useChosenNames('collection', filter.collection);

    useEffect(() => {
        if (!needsTags) {
            return;
        }

        let current = true;

        api.request<TagDto[]>('/tags').then(
            (found) => current && setTags(found),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [needsTags]);

    useEffect(() => {
        if (!needsLocations) {
            return;
        }

        let current = true;

        api.request<BookcaseDto[]>('/bookcases').then(
            (found) => current && setBookcases(found),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, [needsLocations]);

    return useCallback(
        ({ key, value }: FilterEntry): string => {
            const tag = () => tags.find((candidate) => candidate.id === value)?.name ?? '…';

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
                    return authors.get(value) ?? t('filters.someAuthor');
                case 'collection':
                    return value === 'none'
                        ? t('filters.noCollection')
                        : (collections.get(value) ?? t('filters.someCollection'));
                case 'location':
                    return LocationFormat.choice(bookcases, value) ?? t('filters.noLocation');
                case 'tag':
                    return t('filters.include', { name: tag() });
                case 'notTag':
                    return t('filters.exclude', { name: tag() });
            }
        },
        [t, tags, bookcases, authors, collections],
    );
}
