import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { CollectionShoppingDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useAction } from '../../shared/use-action';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { LeafLoadFailure, LeafPage } from '../leaf-page';
import { useLeafResource } from '../use-leaf-resource';

type Missing = CollectionShoppingDto['missing'][number];
type QuickAdd = { volume: number; bookId: string; title: string };

function MarkOwnedDialog({
    collection,
    choice,
    onClose,
    onDone,
}: {
    collection: string;
    choice: QuickAdd | null;
    onClose(): void;
    onDone(volume: number): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const volume = choice?.volume ?? 0;

    return (
        <Dialog
            open={choice !== null}
            title={t('leaf.markOwned.title', { volume })}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button
                        variant="primary"
                        busy={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await api.request('/books/' + choice!.bookId + '/owned', {
                                    method: 'POST',
                                });
                                onDone(volume);
                            })
                        }
                    >
                        {t('leaf.markOwned.confirm')}
                    </Button>
                </>
            }
        >
            <p className="leaf-shopping__book">
                {collection} · {t('leaf.volume', { volume })} · {choice?.title}
            </p>
            <p>{t('leaf.markOwned.body')}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
        </Dialog>
    );
}

function MissingEntry({ entry, onQuickAdd }: { entry: Missing; onQuickAdd(): void }) {
    const { t } = useI18n();
    const label = t('leaf.volume', { volume: entry.volume });
    const state = entry.saved
        ? t('leaf.collection.savedNotOwned')
        : t('leaf.collection.notRegistered');

    return (
        <li className="leaf-volume">
            <span className="leaf-volume__text">
                <span className="leaf-volume__name">{label}</span>
                <span className="leaf-volume__state">{state}</span>
            </span>
            {entry.quickAdd && (
                <Button
                    variant="primary"
                    icon="check"
                    onClick={onQuickAdd}
                    aria-label={t('leaf.collection.markOwnedLabel', { volume: entry.volume })}
                >
                    {t('leaf.collection.markOwned')}
                </Button>
            )}
        </li>
    );
}

function Shopping({ shopping, reload }: { shopping: CollectionShoppingDto; reload(): void }) {
    const { t } = useI18n();
    const [choice, setChoice] = useState<QuickAdd | null>(null);
    const [done, setDone] = useState<number | null>(null);
    const highest = shopping.missing.at(-1)?.volume ?? null;

    return (
        <>
            <p className="muted">
                {t('leaf.collection.owned', {
                    owned: shopping.ownedCount,
                    expected: shopping.expectedCount,
                })}
            </p>
            {shopping.finished && <Notice tone="info">{t('leaf.collection.finished')}</Notice>}
            {done !== null && (
                <Notice tone="success">{t('leaf.markOwned.done', { volume: done })}</Notice>
            )}
            <div className="leaf-shopping__last">
                {shopping.lastOwned ? (
                    <>
                        <p className="eyebrow">{t('leaf.collection.lastOwnedLabel')}</p>
                        <p className="leaf-shopping__last-volume">
                            {String(shopping.lastOwned.volume).padStart(2, '0')}
                        </p>
                        {shopping.lastOwned.title && <p>{shopping.lastOwned.title}</p>}
                    </>
                ) : (
                    <>
                        <p className="eyebrow">{t('leaf.collection.ownership')}</p>
                        <p className="leaf-shopping__none">{t('leaf.shopping.noneOwned')}</p>
                    </>
                )}
            </div>
            {shopping.missing.length === 0 ? (
                <>
                    <h2 className="leaf__subtitle">{t('leaf.shopping.noGaps')}</h2>
                    <p className="muted">{t('leaf.collection.noGapsBody')}</p>
                </>
            ) : (
                <>
                    <h2 className="leaf__subtitle">{t('leaf.collection.missingTitle')}</h2>
                    {highest !== null && (
                        <p className="muted">{t('leaf.collection.through', { volume: highest })}</p>
                    )}
                    <ul className="leaf-volumes">
                        {shopping.missing.map((entry) => (
                            <MissingEntry
                                key={entry.volume}
                                entry={entry}
                                onQuickAdd={() =>
                                    entry.quickAdd &&
                                    setChoice({ volume: entry.volume, ...entry.quickAdd })
                                }
                            />
                        ))}
                    </ul>
                    <p className="muted">{t('leaf.collection.quickAddHint')}</p>
                </>
            )}
            <Link to="/collections" className="button button--secondary">
                <span>{t('leaf.collection.backToList')}</span>
            </Link>
            <MarkOwnedDialog
                collection={shopping.name}
                choice={choice}
                onClose={() => setChoice(null)}
                onDone={(volume) => {
                    setChoice(null);
                    setDone(volume);
                    reload();
                }}
            />
        </>
    );
}

export function CollectionShoppingPage() {
    const { t } = useI18n();
    const { id = '' } = useParams();
    const { resource, reload } = useLeafResource<CollectionShoppingDto>(
        '/collections/' + id + '/shopping',
    );

    return (
        <LeafPage
            back={{ to: '/collections', label: t('leaf.back.collections') }}
            title={resource.status === 'ready' ? resource.data.name : t('leaf.shopping.title')}
        >
            {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}
            {resource.status === 'failed' && (
                <LeafLoadFailure error={resource.error} onRetry={reload} />
            )}
            {resource.status === 'ready' && <Shopping shopping={resource.data} reload={reload} />}
        </LeafPage>
    );
}
