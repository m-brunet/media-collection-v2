import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { StatisticsFormat } from './statistics-format.util';
import { useCount, useKnownOn } from './statistics-parts';

export interface Said {
    text: string;
    emphasis: string | null;
}

const ownership: Record<BookCategory | 'all', [MessageKey, MessageKey]> = {
    all: ['statistics.storyOwnOne', 'statistics.storyOwnMany'],
    books: ['statistics.storyOwnBooksOne', 'statistics.storyOwnBooksMany'],
    manga: ['statistics.storyOwnMangaOne', 'statistics.storyOwnMangaMany'],
    comics: ['statistics.storyOwnComicsOne', 'statistics.storyOwnComicsMany'],
};

export function useStatisticsSentences(statistics: StatisticsDto, category: BookCategory | null) {
    const { t, locale } = useI18n();
    const count = useCount();
    const knownOn = useKnownOn();
    const single = statistics.ownedBooks === 1;
    const library =
        statistics.categories.books + statistics.categories.manga + statistics.categories.comics;
    const owned = StatisticsFormat.number(statistics.ownedBooks, locale);
    const pages = count(statistics.pages.total, 'statistics.pageOne', 'statistics.pageMany');
    const amount = BookFormat.price(statistics.price.totalCents, locale);
    const reading = statistics.reading ?? { read: 0, notRead: 0 };
    const read = StatisticsFormat.number(reading.read, locale);
    const publisher = statistics.publishers.byBooks[0]?.name;
    const author = statistics.authors.byBooks[0]?.name;
    const { finished, unfinished, missingVolumes } = statistics.collections;
    const collections = finished + unfinished;
    const done = StatisticsFormat.number(finished, locale);
    const [ownOne, ownMany] = ownership[category ?? 'all'];

    return {
        own: { text: t(single ? ownOne : ownMany, { count: owned }), emphasis: owned },
        share: category
            ? t(library === 1 ? 'statistics.storyShareOne' : 'statistics.storyShareMany', {
                  percent: StatisticsFormat.percent(statistics.ownedBooks, library, locale),
                  total: StatisticsFormat.number(library, locale),
              })
            : null,
        pages: {
            text: t(single ? 'statistics.storyPagesOne' : 'statistics.storyPagesMany', { pages }),
            emphasis: StatisticsFormat.number(statistics.pages.total, locale),
        },
        pagesCounted: [
            t('statistics.storyCounted', {
                on: knownOn(statistics.pages.known, statistics.ownedBooks),
            }),
            ...(statistics.pages.known < statistics.ownedBooks
                ? [
                      count(
                          statistics.ownedBooks - statistics.pages.known,
                          'statistics.storyNoPagesOne',
                          'statistics.storyNoPagesMany',
                      ),
                  ]
                : []),
        ].join(' '),
        price: {
            text: t(single ? 'statistics.storyPriceOne' : 'statistics.storyPriceMany', { amount }),
            emphasis: amount,
        },
        priceCounted: t('statistics.storyCounted', {
            on: knownOn(statistics.price.known, statistics.ownedBooks),
        }),
        read:
            reading.read + reading.notRead === 1
                ? {
                      text: t(
                          reading.read === 1
                              ? 'statistics.storyReadSingle'
                              : 'statistics.storyUnreadSingle',
                      ),
                      emphasis: null,
                  }
                : { text: t('statistics.storyRead', { count: read }), emphasis: read },
        makers:
            publisher && author
                ? t('statistics.storyMakers', { publisher, author })
                : publisher
                  ? t('statistics.storyPublisher', { publisher })
                  : t('statistics.storyAuthor', { author: author ?? '' }),
        publisher: publisher ? t('statistics.storyPublisher', { publisher }) : null,
        author: author ? t('statistics.storyAuthor', { author }) : null,
        finished:
            collections === 1
                ? {
                      text: t(
                          finished === 1
                              ? 'statistics.storyOnlyFinished'
                              : 'statistics.storyOnlyUnfinished',
                      ),
                      emphasis: null,
                  }
                : {
                      text: t(
                          finished === 1
                              ? 'statistics.storyFinishedOne'
                              : 'statistics.storyFinishedMany',
                          { finished: done, total: StatisticsFormat.number(collections, locale) },
                      ),
                      emphasis: done,
                  },
        missing:
            missingVolumes > 0
                ? count(missingVolumes, 'statistics.storyMissingOne', 'statistics.storyMissingMany')
                : null,
    };
}
