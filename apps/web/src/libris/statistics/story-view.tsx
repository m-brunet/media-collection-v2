import type { ReactNode } from 'react';
import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { StatisticsFormat } from './statistics-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SplitBar } from './split-bar';
import {
    AuthorsRanking,
    BiggestCollectionRecord,
    LongestRecord,
    MostExpensiveRecord,
    PublisherNotes,
    PublishersRanking,
    Sentence,
    WithoutPriceLink,
} from './statistics-parts';
import { useStatisticsSegments } from './use-statistics-segments';
import { useStatisticsSentences } from './use-statistics-sentences';

export function StoryView({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t } = useI18n();
    const segments = useStatisticsSegments(statistics, category);
    const said = useStatisticsSentences(statistics, category);
    const { pages, price, reading, publishers, authors } = statistics;
    const collections = StatisticsFormat.collections(statistics);

    return (
        <div className="statistics-story">
            <Section
                title={t('statistics.storyLibrary')}
                sentence={<Sentence said={said.own} />}
                details={said.share && <p className="muted">{said.share}</p>}
            >
                <SplitBar label={t('statistics.byCategory')} segments={segments.categories} />
            </Section>
            {pages.known > 0 && (
                <Section
                    title={t('statistics.pages')}
                    sentence={<Sentence said={said.pages} />}
                    details={<p className="muted">{said.pagesCounted}</p>}
                >
                    <LongestRecord statistics={statistics} heading="h3" />
                </Section>
            )}
            {price.known > 0 && (
                <Section
                    title={t('statistics.price')}
                    sentence={<Sentence said={said.price} />}
                    details={
                        <p className="muted">
                            {said.priceCounted}{' '}
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
            )}
            {reading && (
                <Section
                    title={t('statistics.yourReading')}
                    sentence={<Sentence said={said.read} />}
                    details={<p className="muted">{t('statistics.readingNote')}</p>}
                >
                    <SplitBar label={t('statistics.yourReading')} segments={segments.reading} />
                </Section>
            )}
            {(publishers.byBooks.length > 0 || authors.byBooks.length > 0) && (
                <Section
                    title={t('statistics.storyMakersTitle')}
                    sentence={said.makers}
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
            )}
            {collections > 0 && (
                <Section
                    title={t('statistics.collections')}
                    sentence={<Sentence said={said.finished} />}
                    details={said.missing && <p className="muted">{said.missing}</p>}
                >
                    <SplitBar label={t('statistics.collections')} segments={segments.collections} />
                    <BiggestCollectionRecord statistics={statistics} heading="h3" />
                </Section>
            )}
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
