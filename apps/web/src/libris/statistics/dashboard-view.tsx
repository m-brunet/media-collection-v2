import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type {
    BookCategory,
    StatisticsBookRecordDto,
    StatisticsDto,
} from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { ChoiceButtons } from '../../shared/ui/choice-buttons';
import { Panel } from '../../shared/ui/layout';
import { BookFilter } from '../filters/book-filter.util';
import { BarRanking } from './bar-ranking';
import { RingChart } from './ring-chart';
import { StatisticsFormat } from './statistics-format.util';

type PublisherOrder = 'books' | 'pages';

const categories: readonly BookCategory[] = ['books', 'manga', 'comics'];
const categoryColors: Record<BookCategory, string> = {
    books: 'var(--color-chart-3)',
    manga: 'var(--color-chart-1)',
    comics: 'var(--color-chart-2)',
};

export function DashboardView({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    return (
        <div className="statistics-dashboard">
            <div className="statistics-grid statistics-grid--numbers">
                <OwnedCard statistics={statistics} />
                <PagesCard statistics={statistics} />
                <PriceCard statistics={statistics} category={category} />
                {statistics.reading && <ReadCard reading={statistics.reading} />}
            </div>
            <div className="statistics-grid statistics-grid--rings">
                <CategoryRing statistics={statistics} category={category} />
                {statistics.reading && <ReadingRing reading={statistics.reading} />}
                <CollectionsRing statistics={statistics} />
            </div>
            <div className="statistics-grid statistics-grid--rankings">
                <PublishersPanel statistics={statistics} />
                <AuthorsPanel statistics={statistics} />
            </div>
            <Records statistics={statistics} />
        </div>
    );
}

function useCount() {
    const { t, locale } = useI18n();

    return (count: number, one: MessageKey, many: MessageKey) =>
        t(count === 1 ? one : many, { count: StatisticsFormat.number(count, locale) });
}

function NumberCard({
    label,
    value,
    children,
}: {
    label: string;
    value: string;
    children: ReactNode;
}) {
    return (
        <Panel className="statistics-card">
            <h2 className="eyebrow">{label}</h2>
            <p className="statistics-card__value">{value}</p>
            <p className="muted">{children}</p>
        </Panel>
    );
}

function KnownOn({ known, total }: { known: number; total: number }) {
    const { t, locale } = useI18n();

    return t(total === 1 ? 'statistics.onBooksOne' : 'statistics.onBooksMany', {
        known: StatisticsFormat.number(known, locale),
        total: StatisticsFormat.number(total, locale),
    });
}

function OwnedCard({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const collections = statistics.collections.finished + statistics.collections.unfinished;

    return (
        <NumberCard
            label={t('statistics.ownedBooks')}
            value={StatisticsFormat.number(statistics.ownedBooks, locale)}
        >
            {t('statistics.inCollections', {
                collections: count(
                    collections,
                    'statistics.collectionCountOne',
                    'statistics.collectionCountMany',
                ),
                single: count(
                    statistics.singleBooks,
                    'statistics.singleBookOne',
                    'statistics.singleBookMany',
                ),
            })}
        </NumberCard>
    );
}

function PagesCard({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();

    return (
        <NumberCard
            label={t('statistics.pages')}
            value={StatisticsFormat.number(statistics.pages.total, locale)}
        >
            <KnownOn known={statistics.pages.known} total={statistics.ownedBooks} />
        </NumberCard>
    );
}

function PriceCard({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t, locale } = useI18n();
    const missing = statistics.ownedBooks - statistics.price.known;
    const filters = BookFilter.write({
        ...BookFilter.empty(),
        ownership: ['owned'],
        price: ['without'],
        category: category ? [category] : [],
    });

    return (
        <NumberCard
            label={t('statistics.price')}
            value={BookFormat.price(statistics.price.totalCents, locale)}
        >
            <KnownOn known={statistics.price.known} total={statistics.ownedBooks} />
            {missing > 0 && (
                <>
                    {' · '}
                    <Link to={'/books?' + filters.toString()}>
                        {t('statistics.withoutPrice', {
                            count: StatisticsFormat.number(missing, locale),
                        })}
                    </Link>
                </>
            )}
        </NumberCard>
    );
}

function ReadCard({ reading }: { reading: NonNullable<StatisticsDto['reading']> }) {
    const { t, locale } = useI18n();
    const owned = reading.read + reading.notRead;

    return (
        <NumberCard
            label={t('statistics.readByYou')}
            value={StatisticsFormat.number(reading.read, locale)}
        >
            {t('statistics.readDetail', {
                percent: StatisticsFormat.percent(reading.read, owned, locale),
                left: StatisticsFormat.number(reading.notRead, locale),
            })}
        </NumberCard>
    );
}

function CategoryRing({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t, locale } = useI18n();
    const total = categories.reduce((sum, value) => sum + statistics.categories[value], 0);

    return (
        <Panel className="statistics-card">
            <h2 className="eyebrow">{t('statistics.byCategory')}</h2>
            <RingChart
                label={t('statistics.byCategory')}
                segments={[...categories]
                    .sort((a, b) => statistics.categories[b] - statistics.categories[a])
                    .map((value) => ({
                        key: value,
                        label: t(`category.${value}`),
                        value: statistics.categories[value],
                        detail:
                            StatisticsFormat.number(statistics.categories[value], locale) +
                            ' · ' +
                            StatisticsFormat.percent(statistics.categories[value], total, locale),
                        color: categoryColors[value],
                        dimmed: category !== null && category !== value,
                    }))}
            />
        </Panel>
    );
}

function ReadingRing({ reading }: { reading: NonNullable<StatisticsDto['reading']> }) {
    const { t, locale } = useI18n();
    const owned = reading.read + reading.notRead;
    const detail = (value: number) =>
        StatisticsFormat.number(value, locale) +
        ' · ' +
        StatisticsFormat.percent(value, owned, locale);

    return (
        <Panel className="statistics-card">
            <h2 className="eyebrow">{t('statistics.yourReading')}</h2>
            <RingChart
                label={t('statistics.yourReading')}
                segments={[
                    {
                        key: 'read',
                        label: t('status.read'),
                        value: reading.read,
                        detail: detail(reading.read),
                        color: 'var(--color-chart-1)',
                    },
                    {
                        key: 'not-read',
                        label: t('status.notRead'),
                        value: reading.notRead,
                        detail: detail(reading.notRead),
                        color: 'var(--color-chart-track)',
                    },
                ]}
                note={t('statistics.readingNote')}
            />
        </Panel>
    );
}

function CollectionsRing({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const { finished, unfinished, missingVolumes } = statistics.collections;

    return (
        <Panel className="statistics-card">
            <h2 className="eyebrow">{t('statistics.collections')}</h2>
            <RingChart
                label={t('statistics.collections')}
                segments={[
                    {
                        key: 'finished',
                        label: t('statistics.finished'),
                        value: finished,
                        detail: StatisticsFormat.number(finished, locale),
                        color: 'var(--color-chart-1)',
                    },
                    {
                        key: 'unfinished',
                        label: t('statistics.unfinished'),
                        value: unfinished,
                        detail: StatisticsFormat.number(unfinished, locale),
                        color: 'var(--color-chart-2)',
                    },
                ]}
                note={count(missingVolumes, 'statistics.missingOne', 'statistics.missingMany')}
            />
        </Panel>
    );
}

function PublishersPanel({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const [order, setOrder] = useState<PublisherOrder>('books');
    const { byBooks, byPages, without } = statistics.publishers;
    const ranked = order === 'books' ? byBooks : byPages;

    return (
        <Panel className="statistics-card">
            <div className="statistics-card__heading">
                <h2 className="eyebrow">{t('statistics.topPublishers')}</h2>
                <ChoiceButtons<PublisherOrder>
                    label={t('statistics.rankBy')}
                    value={order}
                    choices={[
                        { value: 'books', label: t('statistics.byBooks') },
                        { value: 'pages', label: t('statistics.byPages') },
                    ]}
                    onChange={setOrder}
                />
            </div>
            {ranked.length === 0 ? (
                <p className="muted">{t('statistics.noPublishers')}</p>
            ) : (
                <BarRanking
                    label={t('statistics.topPublishers')}
                    entries={ranked.map((publisher) => {
                        const value = order === 'books' ? publisher.books : publisher.pages;

                        return {
                            name: publisher.name,
                            value,
                            display: StatisticsFormat.number(value, locale),
                        };
                    })}
                />
            )}
            {statistics.publishers.count > 0 && statistics.publishers.count < 10 && (
                <p className="muted">
                    {count(
                        statistics.publishers.count,
                        'statistics.onlyPublishersOne',
                        'statistics.onlyPublishersMany',
                    )}
                </p>
            )}
            {without > 0 && (
                <p className="muted">
                    {count(
                        without,
                        'statistics.withoutPublisherOne',
                        'statistics.withoutPublisherMany',
                    )}
                </p>
            )}
        </Panel>
    );
}

function AuthorsPanel({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();

    return (
        <Panel className="statistics-card">
            <div className="statistics-card__heading">
                <h2 className="eyebrow">{t('statistics.topAuthors')}</h2>
                <span className="muted">{t('statistics.authorsBy')}</span>
            </div>
            {statistics.authors.length === 0 ? (
                <p className="muted">{t('statistics.noAuthors')}</p>
            ) : (
                <BarRanking
                    label={t('statistics.topAuthors')}
                    entries={statistics.authors.map((author) => ({
                        name: author.name,
                        value: author.books,
                        display: StatisticsFormat.number(author.books, locale),
                    }))}
                />
            )}
            <p className="muted">{t('statistics.authorsNote')}</p>
        </Panel>
    );
}

function Records({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const { longest, mostExpensive, biggestCollection } = statistics.records;

    if (!longest && !mostExpensive && !biggestCollection) {
        return null;
    }

    return (
        <div className="statistics-grid statistics-grid--records">
            {longest && (
                <BookRecordCard
                    label={t('statistics.longest')}
                    book={longest}
                    value={count(longest.value, 'statistics.pageOne', 'statistics.pageMany')}
                />
            )}
            {mostExpensive && (
                <BookRecordCard
                    label={t('statistics.mostExpensive')}
                    book={mostExpensive}
                    value={BookFormat.price(mostExpensive.value, locale)}
                />
            )}
            {biggestCollection && (
                <RecordCard
                    label={t('statistics.biggestCollection')}
                    name={biggestCollection.name}
                    to={'/collections/' + biggestCollection.id}
                    detail={count(
                        biggestCollection.ownedBooks,
                        'statistics.ownedBookOne',
                        'statistics.ownedBookMany',
                    )}
                />
            )}
        </div>
    );
}

function BookRecordCard({
    label,
    book,
    value,
}: {
    label: string;
    book: StatisticsBookRecordDto;
    value: string;
}) {
    return (
        <RecordCard
            label={label}
            name={book.title}
            to={'/books/' + book.id}
            detail={[...(book.authors.length > 0 ? [book.authors.join(', ')] : []), value].join(
                ' · ',
            )}
        />
    );
}

function RecordCard({
    label,
    name,
    to,
    detail,
}: {
    label: string;
    name: string;
    to: string;
    detail: string;
}) {
    const { t } = useI18n();

    return (
        <Panel className="statistics-card">
            <h2 className="eyebrow">{label}</h2>
            <p className="statistics-card__name">{name}</p>
            <p className="muted">
                {detail} ·{' '}
                <Link to={to} aria-label={t('statistics.openNamed', { name })}>
                    {t('statistics.open')}
                </Link>
            </p>
        </Panel>
    );
}
