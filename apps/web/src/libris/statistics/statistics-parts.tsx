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
import { StatisticsFormat } from './statistics-format.util';

export type Heading = 'h2' | 'h3';

type PublisherOrder = 'books' | 'pages';

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
    const [order, setOrder] = useState<PublisherOrder>('books');
    const ranked =
        order === 'books' ? statistics.publishers.byBooks : statistics.publishers.byPages;

    return (
        <>
            <div className="statistics-card__heading">
                <Title className="eyebrow">{t('statistics.topPublishers')}</Title>
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
    const { t, locale } = useI18n();

    return (
        <>
            <div className="statistics-card__heading">
                <Title className="eyebrow">{t('statistics.topAuthors')}</Title>
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
        </>
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
