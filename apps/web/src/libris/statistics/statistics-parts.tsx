import { useState } from 'react';
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
import type { ChartSegment } from './chart-segment';
import { RingChart } from './ring-chart';
import { SplitBar } from './split-bar';
import { StatisticsFormat } from './statistics-format.util';

export type Heading = 'h2' | 'h3';

export type RankOrder = 'books' | 'pages';

export function RankByChoice({
    label,
    value,
    onChange,
}: {
    label: string;
    value: RankOrder;
    onChange(order: RankOrder): void;
}) {
    const { t } = useI18n();

    return (
        <ChoiceButtons<RankOrder>
            label={label}
            value={value}
            choices={[
                { value: 'books', label: t('statistics.byBooks') },
                { value: 'pages', label: t('statistics.byPages') },
            ]}
            onChange={onChange}
        />
    );
}

export function CountedSplit({
    title,
    choiceLabel,
    books,
    pages,
    paged,
    chart,
    heading: Title,
    note,
}: {
    title: string;
    choiceLabel: string;
    books: readonly ChartSegment[];
    pages: readonly ChartSegment[];
    paged: { known: number; total: number };
    chart: 'ring' | 'bar';
    heading?: Heading;
    note?: string;
}) {
    const { t, locale } = useI18n();
    const [order, setOrder] = useState<RankOrder>('books');
    const segments = order === 'books' ? books : pages;
    const pagesNote =
        order === 'pages' &&
        paged.known < paged.total &&
        t(paged.total === 1 ? 'statistics.pagesKnownOne' : 'statistics.pagesKnownMany', {
            known: StatisticsFormat.number(paged.known, locale),
            total: StatisticsFormat.number(paged.total, locale),
        });

    return (
        <>
            <div className="statistics-card__heading">
                {Title && <Title className="eyebrow">{title}</Title>}
                <RankByChoice label={choiceLabel} value={order} onChange={setOrder} />
            </div>
            {chart === 'ring' ? (
                <RingChart label={title} segments={segments} note={[note, pagesNote]} />
            ) : (
                <>
                    <SplitBar label={title} segments={segments} />
                    {pagesNote && <p className="muted">{pagesNote}</p>}
                </>
            )}
        </>
    );
}

export function Sentence({ said }: { said: { text: string; emphasis: string | null } }) {
    const at = said.emphasis === null ? -1 : said.text.indexOf(said.emphasis);

    return at < 0 || said.emphasis === null ? (
        said.text
    ) : (
        <>
            {said.text.slice(0, at)}
            <strong>{said.emphasis}</strong>
            {said.text.slice(at + said.emphasis.length)}
        </>
    );
}

export function useCount() {
    const { t, locale } = useI18n();

    return (count: number, one: MessageKey, many: MessageKey) =>
        t(count === 1 ? one : many, { count: StatisticsFormat.number(count, locale) });
}

export function useKnownOn() {
    const { t, locale } = useI18n();

    return (known: number, total: number) =>
        t(total === 1 ? 'statistics.onBooksOne' : 'statistics.onBooksMany', {
            known: StatisticsFormat.number(known, locale),
            total: StatisticsFormat.number(total, locale),
        });
}

export function KnownOn({ known, total }: { known: number; total: number }) {
    const knownOn = useKnownOn();

    return knownOn(known, total);
}

export function WithoutPriceLink({
    statistics,
    category,
    one = 'statistics.withoutPrice',
    many = 'statistics.withoutPrice',
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
    one?: MessageKey;
    many?: MessageKey;
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
        missing > 0 && (
            <Link to={'/books?' + filters.toString()}>
                {t(missing === 1 ? one : many, {
                    count: StatisticsFormat.number(missing, locale),
                })}
            </Link>
        )
    );
}

export function PublisherNotes({ statistics }: { statistics: StatisticsDto }) {
    const count = useCount();
    const { count: publishers, without } = statistics.publishers;

    return (
        <>
            {publishers > 0 && publishers < 10 && (
                <p className="muted">
                    {count(
                        publishers,
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
        </>
    );
}

export function PublishersRanking({
    statistics,
    heading: Title,
}: {
    statistics: StatisticsDto;
    heading: Heading;
}) {
    const { t, locale } = useI18n();
    const [order, setOrder] = useState<RankOrder>('books');
    const ranked =
        order === 'books' ? statistics.publishers.byBooks : statistics.publishers.byPages;

    return (
        <>
            <div className="statistics-card__heading">
                <Title className="eyebrow">{t('statistics.topPublishers')}</Title>
                <RankByChoice
                    label={t('statistics.rankPublishersBy')}
                    value={order}
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
        </>
    );
}

export function AuthorsRanking({
    statistics,
    heading: Title,
}: {
    statistics: StatisticsDto;
    heading: Heading;
}) {
    const { t } = useI18n();
    const [order, setOrder] = useState<RankOrder>('books');

    return (
        <>
            <div className="statistics-card__heading">
                <Title className="eyebrow">{t('statistics.topAuthors')}</Title>
                <RankByChoice
                    label={t('statistics.rankAuthorsBy')}
                    value={order}
                    onChange={setOrder}
                />
            </div>
            <AuthorsBars statistics={statistics} order={order} />
        </>
    );
}

export function AuthorsBars({
    statistics,
    order,
}: {
    statistics: StatisticsDto;
    order: RankOrder;
}) {
    const { t, locale } = useI18n();
    const ranked = order === 'books' ? statistics.authors.byBooks : statistics.authors.byPages;

    if (ranked.length === 0) {
        return <p className="muted">{t('statistics.noAuthors')}</p>;
    }

    return (
        <BarRanking
            label={t('statistics.topAuthors')}
            entries={ranked.map((author) => {
                const value = order === 'books' ? author.books : author.pages;

                return {
                    name: author.name,
                    value,
                    display: StatisticsFormat.number(value, locale),
                };
            })}
        />
    );
}

export function LongestRecord({
    statistics,
    heading,
}: {
    statistics: StatisticsDto;
    heading: Heading;
}) {
    const { t } = useI18n();
    const count = useCount();
    const book = statistics.records.longest;

    return (
        book && (
            <BookRecordCard
                heading={heading}
                label={t('statistics.longest')}
                book={book}
                value={count(book.value, 'statistics.pageOne', 'statistics.pageMany')}
            />
        )
    );
}

export function MostExpensiveRecord({
    statistics,
    heading,
}: {
    statistics: StatisticsDto;
    heading: Heading;
}) {
    const { t, locale } = useI18n();
    const book = statistics.records.mostExpensive;

    return (
        book && (
            <BookRecordCard
                heading={heading}
                label={t('statistics.mostExpensive')}
                book={book}
                value={BookFormat.price(book.value, locale)}
            />
        )
    );
}

export function BiggestCollectionRecord({
    statistics,
    heading,
}: {
    statistics: StatisticsDto;
    heading: Heading;
}) {
    const { t } = useI18n();
    const count = useCount();
    const collection = statistics.records.biggestCollection;

    return (
        collection && (
            <RecordCard
                heading={heading}
                label={t('statistics.biggestCollection')}
                name={collection.name}
                to={'/collections/' + collection.id}
                detail={count(
                    collection.ownedBooks,
                    'statistics.ownedBookOne',
                    'statistics.ownedBookMany',
                )}
            />
        )
    );
}

function BookRecordCard({
    heading,
    label,
    book,
    value,
}: {
    heading: Heading;
    label: string;
    book: StatisticsBookRecordDto;
    value: string;
}) {
    return (
        <RecordCard
            heading={heading}
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
    heading: Title,
    label,
    name,
    to,
    detail,
}: {
    heading: Heading;
    label: string;
    name: string;
    to: string;
    detail: string;
}) {
    const { t } = useI18n();

    return (
        <Panel className="statistics-card">
            <Title className="eyebrow">{label}</Title>
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
