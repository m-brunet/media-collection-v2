import type { ReactNode } from 'react';
import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Panel } from '../../shared/ui/layout';
import { RingChart } from './ring-chart';
import { StatisticsFormat } from './statistics-format.util';
import {
    AuthorsRanking,
    BiggestCollectionRecord,
    KnownOn,
    LongestRecord,
    MostExpensiveRecord,
    PublisherNotes,
    PublishersRanking,
    useCount,
    WithoutPriceLink,
} from './statistics-parts';
import { useStatisticsSegments } from './use-statistics-segments';

export function DashboardView({
    statistics,
    category,
}: {
    statistics: StatisticsDto;
    category: BookCategory | null;
}) {
    const { t } = useI18n();
    const count = useCount();
    const segments = useStatisticsSegments(statistics, category);
    const { longest, mostExpensive, biggestCollection } = statistics.records;

    return (
        <div className="statistics-dashboard">
            <div className="statistics-grid statistics-grid--numbers">
                <OwnedCard statistics={statistics} />
                <PagesCard statistics={statistics} />
                <PriceCard statistics={statistics} category={category} />
                {statistics.reading && <ReadCard reading={statistics.reading} />}
            </div>
            <div className="statistics-grid statistics-grid--rings">
                <Panel className="statistics-card">
                    <h2 className="eyebrow">{t('statistics.byCategory')}</h2>
                    <RingChart label={t('statistics.byCategory')} segments={segments.categories} />
                </Panel>
                {statistics.reading && (
                    <Panel className="statistics-card">
                        <h2 className="eyebrow">{t('statistics.yourReading')}</h2>
                        <RingChart
                            label={t('statistics.yourReading')}
                            segments={segments.reading}
                            note={t('statistics.readingNote')}
                        />
                    </Panel>
                )}
                <Panel className="statistics-card">
                    <h2 className="eyebrow">{t('statistics.collections')}</h2>
                    <RingChart
                        label={t('statistics.collections')}
                        segments={segments.collections}
                        note={count(
                            statistics.collections.missingVolumes,
                            'statistics.missingOne',
                            'statistics.missingMany',
                        )}
                    />
                </Panel>
            </div>
            <div className="statistics-grid statistics-grid--rankings">
                <Panel className="statistics-card">
                    <PublishersRanking statistics={statistics} heading="h2" />
                    <PublisherNotes statistics={statistics} />
                </Panel>
                <Panel className="statistics-card">
                    <AuthorsRanking statistics={statistics} heading="h2" />
                    <p className="muted">{t('statistics.authorsNote')}</p>
                </Panel>
            </div>
            {(longest || mostExpensive || biggestCollection) && (
                <div className="statistics-grid statistics-grid--records">
                    <LongestRecord statistics={statistics} heading="h2" />
                    <MostExpensiveRecord statistics={statistics} heading="h2" />
                    <BiggestCollectionRecord statistics={statistics} heading="h2" />
                </div>
            )}
        </div>
    );
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

function OwnedCard({ statistics }: { statistics: StatisticsDto }) {
    const { t, locale } = useI18n();
    const count = useCount();
    const collections = StatisticsFormat.collections(statistics);

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

    return (
        <NumberCard
            label={t('statistics.price')}
            value={BookFormat.price(statistics.price.totalCents, locale)}
        >
            <KnownOn known={statistics.price.known} total={statistics.ownedBooks} />
            {statistics.price.known < statistics.ownedBooks && ' · '}
            <WithoutPriceLink statistics={statistics} category={category} />
        </NumberCard>
    );
}

function ReadCard({ reading }: { reading: NonNullable<StatisticsDto['reading']> }) {
    const { t, locale } = useI18n();

    return (
        <NumberCard
            label={t('statistics.readByYou')}
            value={StatisticsFormat.number(reading.read, locale)}
        >
            {t('statistics.readDetail', {
                percent: StatisticsFormat.percent(
                    reading.read,
                    reading.read + reading.notRead,
                    locale,
                ),
                left: StatisticsFormat.number(reading.notRead, locale),
            })}
        </NumberCard>
    );
}
