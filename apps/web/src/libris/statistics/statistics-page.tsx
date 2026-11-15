import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import type { BookCategory, StatisticsDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { ChoiceButtons } from '../../shared/ui/choice-buttons';
import type { IconName } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { DashboardView } from './dashboard-view';
import { StoryView } from './story-view';

type CategoryChoice = BookCategory | 'all';

interface StatisticsViewEntry {
    id: string;
    label: MessageKey;
    icon: IconName;
    component: ComponentType<{ statistics: StatisticsDto; category: BookCategory | null }>;
}

const views: readonly StatisticsViewEntry[] = [
    {
        id: 'dashboard',
        label: 'statistics.viewDashboard',
        icon: 'overview',
        component: DashboardView,
    },
    { id: 'story', label: 'statistics.viewStory', icon: 'view-story', component: StoryView },
];
const categoryChoices: readonly CategoryChoice[] = ['all', 'books', 'manga', 'comics'];
const rememberedView = 'media-collection.statistics-view';

class ViewMemory {
    static read(): string | null {
        try {
            return window.localStorage.getItem(rememberedView);
        } catch {
            // Justified: the browser may refuse storage; the page then opens on the default view.
            return null;
        }
    }

    static write(view: string): void {
        try {
            window.localStorage.setItem(rememberedView, view);
        } catch {
            // Justified: the browser may refuse storage; the chosen view still applies to this visit.
        }
    }
}

function chosenView(parameter: string | null): StatisticsViewEntry {
    const [fallback] = views as [StatisticsViewEntry];

    return views.find((view) => view.id === (parameter ?? ViewMemory.read())) ?? fallback;
}

function chosenCategory(parameter: string | null): BookCategory | null {
    return categoryChoices.includes(parameter as CategoryChoice) && parameter !== 'all'
        ? (parameter as BookCategory)
        : null;
}

export function StatisticsPage() {
    const { t } = useI18n();
    const [parameters, setParameters] = useSearchParams();
    const category = chosenCategory(parameters.get('category'));
    const view = chosenView(parameters.get('view'));
    const address = '/statistics' + (category ? '?category=' + category : '');
    const [loaded, setLoaded] = useState<{ address: string; value: StatisticsDto } | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const statistics = loaded?.address === address ? loaded.value : null;

    useEffect(() => {
        let current = true;

        api.request<StatisticsDto>(address).then(
            (value) => current && setLoaded({ address, value }),
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [address, attempt, t]);

    const choose = (key: 'category' | 'view', value: string | null) => {
        const next = new URLSearchParams(parameters);

        if (value === null) {
            next.delete(key);
        } else {
            next.set(key, value);
        }

        setParameters(next, { replace: true });
    };
    const chooseView = (id: string) => {
        ViewMemory.write(id);
        choose('view', id);
    };
    const retry = () => {
        setFailure(null);
        setAttempt((value) => value + 1);
    };
    const View = view.component;
    const viewChoice =
        views.length > 1 ? (
            <ChoiceButtons
                label={t('statistics.view')}
                value={view.id}
                choices={views.map((entry) => ({
                    value: entry.id,
                    label: t(entry.label),
                    icon: entry.icon,
                }))}
                onChange={chooseView}
            />
        ) : undefined;

    return (
        <>
            <PageHeader
                title={t('statistics.title')}
                intro={t('statistics.intro')}
                actions={viewChoice}
            />
            <div className="statistics">
                <ChoiceButtons
                    label={t('statistics.show')}
                    hint={t('statistics.showHint')}
                    value={category ?? 'all'}
                    choices={categoryChoices.map((value) => ({
                        value,
                        label: t(value === 'all' ? 'statistics.all' : `category.${value}`),
                    }))}
                    onChange={(value) => choose('category', value === 'all' ? null : value)}
                />
                {failure ? (
                    <Notice tone="error">
                        {failure} <Button onClick={retry}>{t('statistics.retry')}</Button>
                    </Notice>
                ) : !statistics ? (
                    <LoadingState label={t('statistics.loading')} />
                ) : statistics.ownedBooks === 0 ? (
                    <EmptyState
                        icon="statistics"
                        title={
                            category
                                ? t('statistics.emptyCategoryTitle', {
                                      category: t(`category.${category}`),
                                  })
                                : t('statistics.emptyTitle')
                        }
                        body={t('statistics.emptyBody')}
                    />
                ) : (
                    <View statistics={statistics} category={category} />
                )}
            </div>
        </>
    );
}
