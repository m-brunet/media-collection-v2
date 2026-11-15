import { useState } from 'react';
import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import type { ViewEntry } from '../../shared/ui/view-choice';
import { useViewChoice } from '../../shared/ui/view-choice';
import type { BookshelvesViewProps, LocationSelection } from './bookshelves-view';
import type { LocationEditing } from './location-dialogs';
import { LocationDialogs } from './location-dialogs';
import { useBookcases } from './use-bookcases';
import { useLocationCounts } from './use-location-counts';
import { WallView } from './wall-view';

interface BookshelvesViewEntry extends ViewEntry {
    component: ComponentType<BookshelvesViewProps>;
}

const views: readonly BookshelvesViewEntry[] = [
    { id: 'wall', label: 'bookshelves.viewWall', icon: 'view-wall', component: WallView },
];

export function BookshelvesPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const editor = account?.role !== 'guest';
    const counts = useLocationCounts();
    const { bookcases, failure, reload } = useBookcases();
    const [parameters, setParameters] = useSearchParams();
    const { view, choice } = useViewChoice(views, 'media-collection.bookshelves-view');
    const [editing, setEditing] = useState<LocationEditing | null>(null);
    const [done, setDone] = useState<string | null>(null);

    if (failure) {
        return (
            <>
                <PageHeader title={t('bookshelves.title')} />
                <Notice tone="error">{t(failure)}</Notice>
            </>
        );
    }

    if (!bookcases) {
        return <LoadingState label={t('bookshelves.loading')} />;
    }

    const select = (selected: LocationSelection) => {
        const next = new URLSearchParams();
        const kept = parameters.get('view');

        if (kept) {
            next.set('view', kept);
        }

        if (selected.bookcase) {
            next.set('bookcase', selected.bookcase);
        }

        if (selected.shelf) {
            next.set('shelf', selected.shelf);
        }

        setParameters(next, { replace: true });
    };
    const dialogs = (
        <LocationDialogs
            bookcases={bookcases}
            editing={editing}
            onDone={(message, selected) => {
                setEditing(null);
                setDone(message);
                reload();

                if (selected) {
                    select(selected);
                }
            }}
            onClose={() => setEditing(null)}
        />
    );
    const create = editor && (
        <Button
            variant="primary"
            icon="add"
            onClick={() => setEditing({ kind: 'create-bookcase' })}
        >
            {t('bookcase.create')}
        </Button>
    );
    const shelves = bookcases.flatMap((bookcase) => bookcase.shelves);
    const chosen = shelves.find((candidate) => candidate.id === parameters.get('shelf'));
    const bookcase =
        bookcases.find(
            (candidate) => candidate.id === (parameters.get('bookcase') ?? chosen?.bookcaseId),
        ) ?? bookcases[0];

    if (!bookcase) {
        return (
            <>
                <PageHeader title={t('bookshelves.title')} />
                <EmptyState
                    icon="inbox"
                    title={editor ? t('bookshelves.empty') : t('bookshelves.emptyGuest')}
                    action={
                        editor && (
                            <Button
                                variant="primary"
                                onClick={() => setEditing({ kind: 'create-bookcase' })}
                            >
                                {t('bookcase.createFirst')}
                            </Button>
                        )
                    }
                />
                {dialogs}
            </>
        );
    }

    const shelf =
        (chosen?.bookcaseId === bookcase.id ? chosen : undefined) ?? bookcase.shelves[0] ?? null;
    const View = view.component;

    return (
        <>
            <PageHeader
                title={t('bookshelves.title')}
                intro={[
                    counts.bookcases(bookcases.length),
                    counts.shelves(shelves.length),
                    counts.books(bookcases.reduce((total, entry) => total + entry.bookCount, 0)),
                ].join(' · ')}
                actions={
                    (choice || create) && (
                        <div className="actions">
                            {choice}
                            {create}
                        </div>
                    )
                }
            />
            <div className="stack">
                {done && (
                    <Notice tone="success" onClose={() => setDone(null)}>
                        {done}
                    </Notice>
                )}
                <View
                    bookcases={bookcases}
                    bookcase={bookcase}
                    shelf={shelf}
                    editor={editor}
                    onSelect={select}
                    onEdit={setEditing}
                />
            </div>
            {dialogs}
        </>
    );
}
