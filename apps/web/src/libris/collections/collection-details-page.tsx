import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type {
    CollectionDetailsDto,
    CollectionMemberDto,
    CollectionVolumeDto,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { useAction } from '../../shared/use-action';
import { EditCollectionDialog } from './collection-dialogs';
import { CollectionFormat } from './collection-format.util';

function MemberBook({ book }: { book: CollectionMemberDto }) {
    const { t } = useI18n();
    const omnibus = book.volumeTo > book.volumeFrom;
    const detail = omnibus
        ? t('collection.book.omnibus', { from: book.volumeFrom, to: book.volumeTo })
        : book.isbn
          ? t('collection.book.isbn', { isbn: book.isbn })
          : t('collection.book.noIsbn');

    return (
        <li className="volume-entry__book">
            <span className="volume-entry__book-title">{book.title}</span>
            <span className="muted">
                {book.ownership === 'not-owned' ? t('status.notOwned') + ' · ' : ''}
                {detail}
            </span>
            <Link
                to={'/books/' + book.id}
                aria-label={t('collection.book.view') + ' · ' + book.title}
            >
                {t('collection.book.view')} <Icon name="expand" size={14} />
            </Link>
        </li>
    );
}

// One expected volume (or a run of inferred ones): expanding it lists the actual books covering
// it, so the person can choose an edition.
function VolumeEntry({ volume }: { volume: CollectionVolumeDto }) {
    const { t } = useI18n();
    const id = useId();
    const [open, setOpen] = useState(false);
    const label = CollectionFormat.volumes(volume.from, volume.to);
    const state = CollectionFormat.state(volume);
    const expandable = volume.books.length > 0;

    return (
        <li className={'volume-entry volume-entry--' + volume.state}>
            <button
                type="button"
                className="volume-entry__toggle"
                aria-expanded={expandable ? open : undefined}
                aria-controls={expandable ? id : undefined}
                disabled={!expandable}
                onClick={() => setOpen(!open)}
            >
                <Icon name={open ? 'collapse' : 'expand'} size={16} />
                <span className="volume-entry__label">{t(label.key, label.values)}</span>{' '}
                <span className="volume-entry__state">{t(state.key, state.values)}</span>
            </button>
            {expandable && (
                <ul id={id} className="volume-entry__books" hidden={!open}>
                    {volume.books.map((book) => (
                        <MemberBook key={book.id} book={book} />
                    ))}
                </ul>
            )}
        </li>
    );
}

// Coverage of one collection: whole-collection counts, the expected range, Finished/reopen and
// the volumes in coverage order with their editions.
export function CollectionDetailsPage() {
    const { id } = useParams();
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const [collection, setCollection] = useState<CollectionDetailsDto | null>(null);
    const [failure, setFailure] = useState<{ missing: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const action = useAction();
    const editor = account?.role !== 'guest';

    useEffect(() => {
        let current = true;

        api.request<CollectionDetailsDto>('/collections/' + id).then(
            (result) => current && setCollection(result),
            (error: unknown) =>
                current &&
                setFailure({
                    missing: error instanceof ApiError && [400, 404].includes(error.status),
                    text: t(ApiErrorMessage.key(error)),
                }),
        );

        return () => {
            current = false;
        };
    }, [id, t]);

    if (failure?.missing) {
        return (
            <EmptyState
                icon="collections"
                title={t('collection.missing')}
                body={t('collection.missingBody')}
                action={<Link to="/collections">{t('collection.back')}</Link>}
            />
        );
    }

    if (failure) {
        return <Notice tone="error">{failure.text}</Notice>;
    }

    if (!collection) {
        return <LoadingState label={t('common.loading')} />;
    }

    const badge = CollectionFormat.badge(collection);
    const expected = CollectionFormat.volumes(collection.expectedFrom, collection.expectedTo);
    const change = (path: 'finish' | 'reopen') =>
        void action.run(async () =>
            setCollection(
                await api.request<CollectionDetailsDto>(
                    '/collections/' + collection.id + '/' + path,
                    { method: 'POST' },
                ),
            ),
        );

    return (
        <>
            <PageHeader
                title={collection.name}
                breadcrumb={
                    <nav aria-label={t('details.breadcrumb')} className="breadcrumb">
                        <Link to="/collections">{t('collections.title')}</Link>
                        <span aria-hidden="true"> · </span>
                        <span>
                            {t('collection.ownedOf', {
                                owned: collection.ownedCount,
                                expected: collection.expectedCount,
                            })}
                        </span>
                    </nav>
                }
                actions={
                    editor && (
                        <Button
                            variant="primary"
                            icon="add"
                            onClick={() =>
                                navigate(
                                    '/books/new?collection=' + encodeURIComponent(collection.name),
                                )
                            }
                        >
                            {t('books.add')}
                        </Button>
                    )
                }
            />
            <div className="stack">
                <Panel className="collection-summary">
                    <p className="eyebrow">{t(badge.key, badge.values)}</p>
                    <p className="collection-summary__expected">
                        {t('collection.expected', {
                            volumes: t(expected.key, expected.values),
                        })}
                    </p>
                    <p className="muted">
                        {t('collection.facts', {
                            zero: t(
                                collection.includesVolumeZero ? 'collection.on' : 'collection.off',
                            ),
                            highest: collection.expectedTo,
                        })}
                    </p>
                    {editor && (
                        <div className="actions">
                            <Button icon="edit" onClick={() => setEditing(true)}>
                                {t('collection.edit')}
                            </Button>
                            {collection.finished ? (
                                <Button busy={action.busy} onClick={() => change('reopen')}>
                                    {t('collection.reopen')}
                                </Button>
                            ) : (
                                <Button
                                    icon="check"
                                    busy={action.busy}
                                    disabled={collection.missingCount > 0}
                                    aria-describedby={
                                        collection.missingCount > 0
                                            ? 'collection-finish-hint'
                                            : undefined
                                    }
                                    onClick={() => change('finish')}
                                >
                                    {t('collection.finish')}
                                </Button>
                            )}
                        </div>
                    )}
                    {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
                    {collection.finished ? (
                        <p className="muted">{t('collection.finishedHint')}</p>
                    ) : (
                        collection.missingCount > 0 && (
                            <p id="collection-finish-hint" className="muted">
                                {t('collection.finishUnavailable')}
                            </p>
                        )
                    )}
                </Panel>
                <Panel label={t('collection.volumesLabel')}>
                    <ul className="volume-list">
                        {collection.volumes.map((volume) => (
                            <VolumeEntry key={volume.from} volume={volume} />
                        ))}
                    </ul>
                </Panel>
            </div>
            {editor && (
                <EditCollectionDialog
                    collection={collection}
                    open={editing}
                    onClose={() => setEditing(false)}
                    onSaved={(saved) => {
                        setCollection(saved);
                        setEditing(false);
                    }}
                    onDeleted={() =>
                        navigate('/collections', { state: { deleted: collection.name } })
                    }
                />
            )}
        </>
    );
}
