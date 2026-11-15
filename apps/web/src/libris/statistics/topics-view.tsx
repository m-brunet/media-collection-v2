import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Required } from '../../shared/required.util';
import { SplitBar } from './split-bar';
import { StatisticsFormat } from './statistics-format.util';
import type { RankOrder } from './statistics-parts';
import {
    AuthorsBars,
    BiggestCollectionRecord,
    LongestRecord,
    MostExpensiveRecord,
    PublisherNotes,
    RankByChoice,
    Sentence,
    useCount,
    useKnownOn,
    WithoutPriceLink,
} from './statistics-parts';
import { useStatisticsSegments } from './use-statistics-segments';
import { useStatisticsSentences } from './use-statistics-sentences';

type TopicId = 'owned' | 'pages' | 'price' | 'reading' | 'publishers' | 'authors' | 'collections';

interface Topic {
    id: TopicId;
    label: MessageKey;
    value: string | null;
    detail: string;
}

const dash = '—';

export function TopicsView({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t } = useI18n();
    const name = useId();
    const [parameters, setParameters] = useSearchParams();
    const topics = useTopics(statistics, category);
    const chosen =
        topics.find((topic) => topic.id === parameters.get('topic')) ??
        Required.at(topics, 0, 'the owned books topic is always offered');
    const choose = (id: TopicId) => {
        const next = new URLSearchParams(parameters);

        next.set('topic', id);
        setParameters(next, { replace: true });
    };

    return (
        <div className="statistics-topics">
            <fieldset className="statistics-topics__menu">
                <legend className="visually-hidden">{t('statistics.topicsLabel')}</legend>
                {topics.map((topic) => (
                    <label
                        key={topic.id}
                        className={
                            topic.id === chosen.id
                                ? 'statistics-topic statistics-topic--chosen'
                                : 'statistics-topic'
                        }
                    >
                        <input
                            type="radio"
                            className="visually-hidden"
                            name={name}
                            value={topic.id}
                            checked={topic.id === chosen.id}
                            onChange={() => choose(topic.id)}
                        />
                        <span className="statistics-topic__label">{t(topic.label)}</span>
                        <b className="statistics-topic__value">{topic.value ?? dash}</b>
                        <small className="statistics-topic__detail">
                            {topic.value === null ? t('statistics.topicsNothing') : topic.detail}
                        </small>
                    </label>
                ))}
            </fieldset>
            <section className="panel statistics-topics__panel">
                {chosen.value === null ? (
                    <>
                        <p className="eyebrow">{t(chosen.label)}</p>
                        <h2 className="statistics-topics__title">{t('statistics.topicsEmpty')}</h2>
                    </>
                ) : (
                    <TopicPanel topic={chosen.id} statistics={statistics} category={category} />
                )}
            </section>
        </div>
    );
}

function useTopics(statistics: StatisticsDto, category: BookCategory | null): Topic[] {
    const { t, locale } = useI18n();
    const count = useCount();
    const knownOn = useKnownOn();
    const segments = useStatisticsSegments(statistics, category);
    const number = (value: number) => StatisticsFormat.number(value, locale);
    const { reading, publishers, authors } = statistics;
    const publisher = publishers.byBooks[0];
    const author = authors.byBooks[0];
    const { finished, unfinished, missingVolumes } = statistics.collections;
    const collections = finished + unfinished;

    return [
        {
            id: 'owned',
            label: 'statistics.ownedBooks',
            value: number(statistics.ownedBooks),
            detail: category
                ? t(
                      segments.library === 1
                          ? 'statistics.topicsShareOne'
                          : 'statistics.topicsShareMany',
                      {
                          percent: StatisticsFormat.percent(
                              statistics.ownedBooks,
                              segments.library,
                              locale,
                          ),
                          total: number(segments.library),
                      },
                  )
                : segments.categories
                      .map((segment) => segment.label + ' ' + number(segment.value))
                      .join(' · '),
        },
        {
            id: 'pages',
            label: 'statistics.pages',
            value: statistics.pages.known > 0 ? number(statistics.pages.total) : null,
            detail: knownOn(statistics.pages.known, statistics.ownedBooks),
        },
        {
            id: 'price',
            label: 'statistics.price',
            value:
                statistics.price.known > 0
                    ? BookFormat.price(statistics.price.totalCents, locale)
                    : null,
            detail: knownOn(statistics.price.known, statistics.ownedBooks),
        },
        ...(reading
            ? [
                  {
                      id: 'reading' as const,
                      label: 'statistics.readByYou' as const,
                      value: number(reading.read),
                      detail: t('statistics.topicsReadDetail', {
                          percent: StatisticsFormat.percent(
                              reading.read,
                              reading.read + reading.notRead,
                              locale,
                          ),
                          left: number(reading.notRead),
                      }),
                  },
              ]
            : []),
        {
            id: 'publishers',
            label: 'statistics.topicTopPublisher',
            value: publisher?.name ?? null,
            detail: publisher
                ? count(publisher.books, 'statistics.bookOne', 'statistics.bookMany') +
                  ' · ' +
                  count(publisher.pages, 'statistics.pageOne', 'statistics.pageMany')
                : '',
        },
        {
            id: 'authors',
            label: 'statistics.topicTopAuthor',
            value: author?.name ?? null,
            detail: author ? count(author.books, 'statistics.bookOne', 'statistics.bookMany') : '',
        },
        {
            id: 'collections',
            label: 'statistics.topicFinished',
            value:
                collections > 0
                    ? t('statistics.topicsOf', {
                          part: number(finished),
                          total: number(collections),
                      })
                    : null,
            detail: count(
                missingVolumes,
                'statistics.topicsMissingOne',
                'statistics.topicsMissingMany',
            ),
        },
    ];
}

function TopicPanel({
    topic,
    statistics,
    category,
}: {
    topic: TopicId;
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t } = useI18n();
    const segments = useStatisticsSegments(statistics, category);
    const said = useStatisticsSentences(statistics, category);

    switch (topic) {
        case 'owned':
            return (
                <PanelContent
                    eyebrow={t('statistics.ownedBooks')}
                    title={<Sentence said={said.own} />}
                >
                    {said.share && <p className="muted">{said.share}</p>}
                    <SplitBar label={t('statistics.byCategory')} segments={segments.categories} />
                </PanelContent>
            );
        case 'pages':
            return (
                <PanelContent
                    eyebrow={t('statistics.pages')}
                    title={<Sentence said={said.pages} />}
                >
                    <p className="muted">{said.pagesCounted}</p>
                    <LongestRecord statistics={statistics} heading="h3" />
                </PanelContent>
            );
        case 'price':
            return (
                <PanelContent
                    eyebrow={t('statistics.price')}
                    title={<Sentence said={said.price} />}
                >
                    <p className="muted">
                        {said.priceCounted}{' '}
                        <WithoutPriceLink
                            statistics={statistics}
                            category={category}
                            one="statistics.storyWithoutPriceOne"
                            many="statistics.storyWithoutPriceMany"
                        />
                    </p>
                    <MostExpensiveRecord statistics={statistics} heading="h3" />
                </PanelContent>
            );
        case 'reading':
            return (
                <PanelContent
                    eyebrow={t('statistics.yourReading')}
                    title={<Sentence said={said.read} />}
                >
                    <SplitBar label={t('statistics.yourReading')} segments={segments.reading} />
                    <p className="muted">{t('statistics.readingNote')}</p>
                </PanelContent>
            );
        case 'publishers':
            return (
                <PanelContent eyebrow={t('statistics.topicsPublishers')} title={said.publisher}>
                    <p className="muted">{t('statistics.topicsPublishersIntro')}</p>
                    <PublishersTable statistics={statistics} />
                    <PublisherNotes statistics={statistics} />
                </PanelContent>
            );
        case 'authors':
            return <AuthorsPanel statistics={statistics} title={said.author} />;
        case 'collections':
            return (
                <PanelContent
                    eyebrow={t('statistics.collections')}
                    title={<Sentence said={said.finished} />}
                >
                    {said.missing && <p className="muted">{said.missing}</p>}
                    <SplitBar label={t('statistics.collections')} segments={segments.collections} />
                    <BiggestCollectionRecord statistics={statistics} heading="h3" />
                </PanelContent>
            );
    }
}

function PanelContent({
    eyebrow,
    title,
    children,
}: {
    eyebrow: string;
    title: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="statistics-topics__title">{title}</h2>
            {children}
        </>
    );
}

function AuthorsPanel({ statistics, title }: { statistics: StatisticsDto; title: string | null }) {
    const { t } = useI18n();
    const [order, setOrder] = useState<RankOrder>('books');

    return (
        <PanelContent eyebrow={t('statistics.topicsAuthors')} title={title}>
            <RankByChoice label={t('statistics.rankAuthorsBy')} value={order} onChange={setOrder} />
            <p className="muted">
                {order === 'books'
                    ? t('statistics.topicsAuthorsIntro')
                    : t('statistics.topicsAuthorsIntroPages')}
            </p>
            <AuthorsBars statistics={statistics} order={order} />
            <p className="muted">{t('statistics.authorsNote')}</p>
        </PanelContent>
    );
}

function PublishersTable({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const ranked = statistics.publishers.byBooks;
    const books = Math.max(1, ...ranked.map((publisher) => publisher.books));
    const pages = Math.max(1, ...ranked.map((publisher) => publisher.pages));

    return (
        <table className="statistics-publishers">
            <caption className="visually-hidden">{t('statistics.topPublishers')}</caption>
            <thead>
                <tr>
                    <th scope="col">#</th>
                    <th scope="col">{t('statistics.topicsPublisher')}</th>
                    <th scope="col" colSpan={2}>
                        {t('statistics.topicsBooks')}
                    </th>
                    <th scope="col" colSpan={2}>
                        {t('statistics.pages')}
                    </th>
                </tr>
            </thead>
            <tbody>
                {ranked.map((publisher, index) => (
                    <tr key={publisher.name}>
                        <td className="statistics-ranking__rank">{index + 1}</td>
                        <th scope="row">{publisher.name}</th>
                        <td aria-hidden="true">
                            <span className="statistics-ranking__bar">
                                <span
                                    className="statistics-ranking__fill"
                                    style={{ width: (publisher.books / books) * 100 + '%' }}
                                />
                            </span>
                        </td>
                        <td className="statistics-ranking__value">
                            {StatisticsFormat.number(publisher.books, locale)}
                        </td>
                        <td aria-hidden="true">
                            <span className="statistics-ranking__bar">
                                <span
                                    className="statistics-ranking__fill statistics-ranking__fill--pages"
                                    style={{ width: (publisher.pages / pages) * 100 + '%' }}
                                />
                            </span>
                        </td>
                        <td className="statistics-ranking__value">
                            {StatisticsFormat.number(publisher.pages, locale)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
