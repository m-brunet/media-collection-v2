import { Link } from 'react-router';
import type { ShoppingCollectionDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { LeafLoadFailure, LeafPage } from '../leaf-page';
import { useLeafResource } from '../use-leaf-resource';

function Progress({ collection }: { collection: ShoppingCollectionDto }) {
    const { t } = useI18n();

    if (collection.missingCount === 0) {
        return <>{t('leaf.shopping.noGaps')}</>;
    }

    const missing =
        collection.missingCount === 1
            ? t('leaf.shopping.missingOne')
            : t('leaf.shopping.missingMany', { count: collection.missingCount });
    const owned =
        collection.lastOwned === null
            ? t('leaf.shopping.noneOwned')
            : t('leaf.shopping.lastOwned', { volume: collection.lastOwned });

    return <>{missing + ' · ' + owned}</>;
}

// Finished ones are left out by the server.
export function ShoppingListPage() {
    const { t } = useI18n();
    const { resource, reload } = useLeafResource<ShoppingCollectionDto[]>('/collections/shopping');

    return (
        <LeafPage
            back={{ to: '/', label: t('leaf.back.home') }}
            title={t('leaf.shopping.title')}
            intro={t('leaf.shopping.intro')}
        >
            {resource.status === 'loading' && <LoadingState label={t('common.loading')} />}
            {resource.status === 'failed' && (
                <LeafLoadFailure error={resource.error} onRetry={reload} />
            )}
            {resource.status === 'ready' &&
                (resource.data.length === 0 ? (
                    <EmptyState
                        icon="collections"
                        title={t('leaf.shopping.empty')}
                        body={t('leaf.shopping.emptyBody')}
                    />
                ) : (
                    <ul className="leaf-list">
                        {resource.data.map((collection) => (
                            <li key={collection.id}>
                                <Link
                                    to={'/collections/' + collection.id}
                                    className="leaf-list__item"
                                >
                                    <span className="leaf-list__name">{collection.name}</span>
                                    <span className="leaf-list__detail">
                                        <Progress collection={collection} />
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ))}
            <p className="muted">{t('leaf.shopping.finishedHidden')}</p>
        </LeafPage>
    );
}
