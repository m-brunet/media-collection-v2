import type { ReactNode } from 'react';
import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SplitBar } from './split-bar';
import { StatisticsFormat } from './statistics-format.util';
import {
    AuthorsRanking,
    BiggestCollectionRecord,
    LongestRecord,
    MostExpensiveRecord,
    PublisherNotes,
    PublishersRanking,
    useCount,
    useKnownOn,
    WithoutPriceLink,
} from './statistics-parts';
import { useStatisticsSegments } from './use-statistics-segments';

const ownership: Record<BookCategory | 'all', [MessageKey, MessageKey]> = {
    all: ['statistics.storyOwnOne', 'statistics.storyOwnMany'],
    books: ['statistics.storyOwnBooksOne', 'statistics.storyOwnBooksMany'],
    manga: ['statistics.storyOwnMangaOne', 'statistics.storyOwnMangaMany'],
    comics: ['statistics.storyOwnComicsOne', 'statistics.storyOwnComicsMany'],
};

export function StoryView({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { pages, price, reading, publishers, authors } = statistics;
    const collections = statistics.collections.finished + statistics.collections.unfinished;

    return (
        <div className="statistics-story">
            <LibrarySection statistics={statistics} category={category} />
            {pages.known > 0 && <PagesSection statistics={statistics} />}
            {price.known > 0 && <PriceSection statistics={statistics} category={category} />}
            {reading && <ReadingSection statistics={statistics} />}
            {(publishers.byBooks.length > 0 || authors.length > 0) && (
                <MakersSection statistics={statistics} />
            )}
            {collections > 0 && <CollectionsSection statistics={statistics} />}
        </div>
    );
}

function Section({
    title,
    sentence,
    details,
    children,
}: {
    title: string;
    sentence: ReactNode;
    details?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="statistics-story__section">
            <div>
                <h2 className="eyebrow">{title}</h2>
                <p className="statistics-story__sentence">{sentence}</p>
                {details}
            </div>
            <div className="statistics-story__visual">{children}</div>
        </section>
    );
}

function Sentence({ text, emphasis }: { text: string; emphasis: string }) {
    const at = text.indexOf(emphasis);

    return at < 0 ? (
        text
    ) : (
        <>
            {text.slice(0, at)}
            <strong>{emphasis}</strong>
            {text.slice(at + emphasis.length)}
        </>
    );
}

function LibrarySection({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t, locale } = useI18n();
    const segments = useStatisticsSegments(statistics, category);
    const [one, many] = ownership[category ?? 'all'];
    const owned = StatisticsFormat.number(statistics.ownedBooks, locale);

    return (
        <Section
            title={t('statistics.storyLibrary')}
            sentence={
                <Sentence
                    text={t(statistics.ownedBooks === 1 ? one : many, { count: owned })}
                    emphasis={owned}
                />
            }
            details={
                category && (
                    <p className="muted">
                        {t(
                            segments.library === 1
                                ? 'statistics.storyShareOne'
                                : 'statistics.storyShareMany',
                            {
                                percent: StatisticsFormat.percent(
                                    statistics.ownedBooks,
                                    segments.library,
                                    locale,
                                ),
                                total: StatisticsFormat.number(segments.library, locale),
                            },
                        )}
                    </p>
                )
            }
        >
            <SplitBar label={t('statistics.byCategory')} segments={segments.categories} />
        </Section>
    );
}

function PagesSection({ statistics }: { statistics: StatisticsDto }) {
    const { t } = useI18n();
    const count = useCount();
    const knownOn = useKnownOn();
    const pages = count(statistics.pages.total, 'statistics.pageOne', 'statistics.pageMany');
    const missing = statistics.ownedBooks - statistics.pages.known;

    return (
        <Section
            title={t('statistics.pages')}
            sentence={
                <Sentence
                    text={t(
                        statistics.ownedBooks === 1
                            ? 'statistics.storyPagesOne'
                            : 'statistics.storyPagesMany',
                        { pages },
                    )}
                    emphasis={pages.replace(/\D+$/, '')}
                />
            }
            details={
                <p className="muted">
                    {t('statistics.storyCounted', {
                        on: knownOn(statistics.pages.known, statistics.ownedBooks),
                    })}{' '}
                    {missing > 0 &&
                        count(missing, 'statistics.storyNoPagesOne', 'statistics.storyNoPagesMany')}
                </p>
            }
        >
            <LongestRecord statistics={statistics} heading="h3" />
        </Section>
    );
}

function PriceSection({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t, locale } = useI18n();
    const knownOn = useKnownOn();
    const amount = BookFormat.price(statistics.price.totalCents, locale);

    return (
        <Section
            title={t('statistics.price')}
            sentence={
                <Sentence
                    text={t(
                        statistics.ownedBooks === 1
                            ? 'statistics.storyPriceOne'
                            : 'statistics.storyPriceMany',
                        { amount },
                    )}
                    emphasis={amount}
                />
            }
            details={
                <p className="muted">
                    {t('statistics.storyCounted', {
                        on: knownOn(statistics.price.known, statistics.ownedBooks),
                    })}{' '}
                    <WithoutPriceLink
                        statistics={statistics}
                        category={category}
                        one="statistics.storyWithoutPriceOne"
                        many="statistics.storyWithoutPriceMany"
                    />
                </p>
            }
        >
            <MostExpensiveRecord statistics={statistics} heading="h3" />
        </Section>
    );
}

function ReadingSection({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const segments = useStatisticsSegments(statistics, null);
    const reading = statistics.reading ?? { read: 0, notRead: 0 };
    const read = StatisticsFormat.number(reading.read, locale);
    const single = reading.read + reading.notRead === 1;

    return (
        <Section
            title={t('statistics.yourReading')}
            sentence={
                single ? (
                    t(
                        reading.read === 1
                            ? 'statistics.storyReadSingle'
                            : 'statistics.storyUnreadSingle',
                    )
                ) : (
                    <Sentence text={t('statistics.storyRead', { count: read })} emphasis={read} />
                )
            }
            details={<p className="muted">{t('statistics.readingNote')}</p>}
        >
            <SplitBar label={t('statistics.yourReading')} segments={segments.reading} />
        </Section>
    );
}

function MakersSection({ statistics }: { statistics: StatisticsDto }) {
    const { t } = useI18n();
    const publisher = statistics.publishers.byBooks[0]?.name;
    const author = statistics.authors[0]?.name;
    const sentence =
        publisher && author
            ? t('statistics.storyMakers', { publisher, author })
            : publisher
              ? t('statistics.storyPublisher', { publisher })
              : t('statistics.storyAuthor', { author: author ?? '' });

    return (
        <Section
            title={t('statistics.storyMakersTitle')}
            sentence={sentence}
            details={
                <>
                    <PublisherNotes statistics={statistics} />
                    <p className="muted">{t('statistics.authorsNote')}</p>
                </>
            }
        >
            <div className="statistics-story__rankings">
                <div>
                    <PublishersRanking statistics={statistics} heading="h3" />
                </div>
                <div>
                    <AuthorsRanking statistics={statistics} heading="h3" />
                </div>
            </div>
        </Section>
    );
}

function CollectionsSection({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const segments = useStatisticsSegments(statistics, null);
    const { finished, unfinished, missingVolumes } = statistics.collections;
    const total = finished + unfinished;
    const done = StatisticsFormat.number(finished, locale);
    const sentence =
        total === 1
            ? t(finished === 1 ? 'statistics.storyOnlyFinished' : 'statistics.storyOnlyUnfinished')
            : t(finished === 1 ? 'statistics.storyFinishedOne' : 'statistics.storyFinishedMany', {
                  finished: done,
                  total: StatisticsFormat.number(total, locale),
              });

    return (
        <Section
            title={t('statistics.collections')}
            sentence={total === 1 ? sentence : <Sentence text={sentence} emphasis={done} />}
            details={
                missingVolumes > 0 && (
                    <p className="muted">
                        {count(
                            missingVolumes,
                            'statistics.storyMissingOne',
                            'statistics.storyMissingMany',
                        )}
                    </p>
                )
            }
        >
            <SplitBar label={t('statistics.collections')} segments={segments.collections} />
            <BiggestCollectionRecord statistics={statistics} heading="h3" />
        </Section>
    );
}
