import { useEffect, useId, useMemo, useState } from 'react';
import type { ActivityEntryDto, ActivityPageDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { RelativeTime } from '../../shared/i18n/relative-time.util';
import { Button } from '../../shared/ui/button';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { ActivitySentence } from './activity-sentence.util';

// The current time, refreshed every minute so relative times stay true while the page is open.
function useNow(): Date {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);

        return () => clearInterval(timer);
    }, []);

    return now;
}

// The relative time of an entry. Hovering it or giving it keyboard focus shows the exact date,
// time, time zone and acting account; Escape hides it again.
function EntryTime({ entry, relative }: { entry: ActivityEntryDto; relative: string }) {
    const { t, dates } = useI18n();
    const id = useId();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const moment = dates.exact(entry.occurredAt);
    const details = entry.actor ? t('activity.details', { moment, actor: entry.actor }) : moment;
    const open = (hovered || focused) && !dismissed;

    return (
        <span
            className="activity-time"
            onMouseEnter={() => {
                setDismissed(false);
                setHovered(true);
            }}
            onMouseLeave={() => setHovered(false)}
        >
            <time
                dateTime={entry.occurredAt}
                tabIndex={0}
                aria-describedby={id}
                className="activity-time__relative"
                onFocus={() => {
                    setDismissed(false);
                    setFocused(true);
                }}
                onBlur={() => setFocused(false)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        setDismissed(true);
                    }
                }}
            >
                {relative}
            </time>
            <span role="tooltip" id={id} className="activity-time__details" hidden={!open}>
                {details}
            </span>
        </span>
    );
}

// Shared Activity, newest first, with older entries loaded on request. Every entry says "You"
// for the household; the acting account appears only in the time details.
export function ActivityPage() {
    const { t, locale } = useI18n();
    const now = useNow();
    const relative = useMemo(() => new RelativeTime(locale, t('activity.justNow')), [locale, t]);
    const [entries, setEntries] = useState<ActivityEntryDto[] | null>(null);
    const [older, setOlder] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [olderFailure, setOlderFailure] = useState<string | null>(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let current = true;

        api.request<ActivityPageDto>('/activity').then(
            (page) => {
                if (current) {
                    setEntries(page.entries);
                    setOlder(page.older);
                }
            },
            (error: unknown) => current && setFailure(t(ApiErrorMessage.key(error))),
        );

        return () => {
            current = false;
        };
    }, [attempt, t]);

    const retry = () => {
        setFailure(null);
        setAttempt((value) => value + 1);
    };
    const loadOlder = async () => {
        if (!older) {
            return;
        }

        setLoadingOlder(true);
        setOlderFailure(null);

        try {
            const page = await api.request<ActivityPageDto>(
                '/activity?before=' + encodeURIComponent(older),
            );

            setEntries((shown) => [...(shown ?? []), ...page.entries]);
            setOlder(page.older);
        } catch {
            setOlderFailure(t('activity.olderFailed'));
        } finally {
            setLoadingOlder(false);
        }
    };

    return (
        <>
            <PageHeader title={t('activity.title')} intro={t('activity.intro')} />
            {failure ? (
                <Notice tone="error">
                    {failure} <Button onClick={retry}>{t('activity.retry')}</Button>
                </Notice>
            ) : !entries ? (
                <LoadingState label={t('activity.loading')} />
            ) : entries.length === 0 ? (
                <EmptyState
                    icon="activity"
                    title={t('activity.emptyTitle')}
                    body={t('activity.emptyBody')}
                />
            ) : (
                <div className="activity">
                    <ol className="activity-list" aria-label={t('activity.listLabel')}>
                        {entries.map((entry) => {
                            const also = ActivitySentence.also(entry.also, t);

                            return (
                                <li key={entry.id} className="activity-entry">
                                    <div className="activity-entry__text">
                                        <p className="activity-entry__action">
                                            {ActivitySentence.main(entry.event, t)}
                                        </p>
                                        {also && <p className="activity-entry__also">{also}</p>}
                                    </div>
                                    <EntryTime
                                        entry={entry}
                                        relative={relative.of(entry.occurredAt, now)}
                                    />
                                </li>
                            );
                        })}
                    </ol>
                    {olderFailure && <Notice tone="error">{olderFailure}</Notice>}
                    {older && (
                        <Button busy={loadingOlder} onClick={() => void loadOlder()}>
                            {t('activity.loadOlder')}
                        </Button>
                    )}
                </div>
            )}
        </>
    );
}
