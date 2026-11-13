import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type {
    CollectionDetailsDto,
    CollectionReadingDto,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { useAction } from '../../shared/use-action';
import { ReadingToggle } from '../../shared/book-form/reading-toggle';
import { CollectionBatchEditor } from './collection-batch-editor';
import { CollectionCovers } from './collection-covers.util';
import { EditCollectionDialog } from './collection-dialogs';
import { CollectionFormat } from './collection-format.util';
import { CollectionWall } from './collection-wall';
import { useTooltip } from './use-tooltip';

function ReadingControl({ collection }: { collection: CollectionDetailsDto }) {
    const { t } = useI18n();
    const action = useAction();
    const tooltip = useTooltip(true);
    const [reading, setReading] = useState<CollectionReadingDto | null>(null);
    const [confirming, setConfirming] = useState(false);
    const address = '/collections/' + collection.id + '/reading';

    useEffect(() => {
        let current = true;

        api.request<CollectionReadingDto>(address).then(
            (result) => current && setReading(result),
            () => current && setReading(null),
        );

        return () => {
            current = false;
        };
    }, [address]);

    if (!reading || reading.ownedCount === 0) {
        return null;
    }

    const save = (read: boolean) =>
        void action.run(async () => {
            setReading(
                await api.request<CollectionReadingDto>(address, {
                    method: 'PUT',
                    body: { read },
                }),
            );
            setConfirming(false);
        });
    const scope =
        reading.ownedCount === 1
            ? t('collection.readingScopeOne')
            : t('collection.readingScopeMany', { count: reading.ownedCount });

    return (
        <div className="collection-reading">
            <span className="collection-tip collection-tip--end" {...tooltip.anchor}>
                <ReadingToggle
                    read={reading.read}
                    busy={action.busy}
                    {...tooltip.trigger}
                    onToggle={(next) => (next ? save(true) : setConfirming(true))}
                />
                <span
                    role="tooltip"
                    id={tooltip.id}
                    className="collection-tip__text"
                    hidden={!tooltip.open}
                >
                    {scope} {t('details.readingHint')}
                </span>
            </span>
            {action.feedback && !confirming && <Notice tone="error">{action.feedback.text}</Notice>}
            <Dialog
                open={confirming}
                title={t('collection.unreadTitle')}
                onClose={() => setConfirming(false)}
                footer={
                    <>
                        <Button onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
                        <Button variant="danger" busy={action.busy} onClick={() => save(false)}>
                            {t('collection.unreadConfirm')}
                        </Button>
                    </>
                }
            >
                <p>{t('collection.unreadBody', { name: collection.name })}</p>
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </Dialog>
        </div>
    );
}

function FinishButton({
    blocked,
    busy,
    onFinish,
}: {
    blocked: boolean;
    busy: boolean;
    onFinish(): void;
}) {
    const { t } = useI18n();
    const tooltip = useTooltip(blocked);

    return (
        <span className="collection-tip collection-tip--end" {...tooltip.anchor}>
            <Button
                icon="check"
                busy={busy}
                aria-disabled={blocked || undefined}
                {...tooltip.trigger}
                onClick={() => !blocked && onFinish()}
            >
                {t('collection.finish')}
            </Button>
            {blocked && (
                <span
                    role="tooltip"
                    id={tooltip.id}
                    className="collection-tip__text"
                    hidden={!tooltip.open}
                >
                    {t('collection.finishUnavailable')}
                </span>
            )}
        </span>
    );
}

function StatusLabel({ finished }: { finished: boolean }) {
    const { t } = useI18n();
    const tooltip = useTooltip(finished);
    const label = CollectionFormat.label(finished);

    return (
        <span className="collection-tip" {...(finished ? tooltip.anchor : {})}>
            <span
                className={
                    'collection-label collection-label--' + (finished ? 'finished' : 'unfinished')
                }
                {...(finished ? { tabIndex: 0, ...tooltip.trigger } : {})}
            >
                {t(label.key)}
            </span>
            {finished && (
                <span
                    role="tooltip"
                    id={tooltip.id}
                    className="collection-tip__text"
                    hidden={!tooltip.open}
                >
                    {t('collection.finishedHint')}
                </span>
            )}
        </span>
    );
}

export function CollectionDetailsPage() {
    const { id } = useParams();
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const [collection, setCollection] = useState<CollectionDetailsDto | null>(null);
    const [failure, setFailure] = useState<{ missing: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [batching, setBatching] = useState(false);
    const [version, setVersion] = useState(0);
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
    }, [id, t, version]);

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

    const coverage = CollectionFormat.coverage(collection);
    const expected = CollectionFormat.expected(collection);
    const blocked = !collection.finished && collection.missingCount > 0;
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
                label={<StatusLabel finished={collection.finished} />}
                breadcrumb={
                    <nav aria-label={t('details.breadcrumb')} className="breadcrumb">
                        <Link to="/collections">{t('collections.title')}</Link>
                        <span aria-hidden="true"> / </span>
                        <span>{collection.name}</span>
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
            <div className="collection-page">
                <div className="collection-summary">
                    <div className="collection-summary__coverage">
                        <p className="eyebrow">{t(coverage.key, coverage.values)}</p>
                        <p className="collection-summary__expected">
                            {t(expected.key, expected.values)}
                        </p>
                        <p className="collection-summary__facts">
                            {t('collection.facts', {
                                zero: t(
                                    collection.includesVolumeZero
                                        ? 'collection.on'
                                        : 'collection.off',
                                ),
                                highest: collection.expectedTo,
                            })}
                        </p>
                    </div>
                    {editor && (
                        <div className="actions collection-summary__actions">
                            <Button icon="edit" onClick={() => setEditing(true)}>
                                {t('collection.edit')}
                            </Button>
                            {!batching && (
                                <Button onClick={() => setBatching(true)}>
                                    {t('batch.editSeveral')}
                                </Button>
                            )}
                            {collection.finished ? (
                                <Button busy={action.busy} onClick={() => change('reopen')}>
                                    {t('collection.reopen')}
                                </Button>
                            ) : (
                                <FinishButton
                                    blocked={blocked}
                                    busy={action.busy}
                                    onFinish={() => change('finish')}
                                />
                            )}
                        </div>
                    )}
                </div>
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
                {editor && batching ? (
                    <CollectionBatchEditor
                        collection={collection}
                        onSaved={() => setVersion((current) => current + 1)}
                        onExit={() => setBatching(false)}
                    />
                ) : (
                    <CollectionWall
                        slots={CollectionCovers.slots(collection)}
                        eyebrow={t('collection.volumesLabel')}
                        hint={t('collection.wallHint')}
                        action={editor && <ReadingControl key={version} collection={collection} />}
                        link={(book) => '/books/' + book.id}
                    />
                )}
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
