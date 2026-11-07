import { Link } from 'react-router';
import { useI18n } from '../shared/i18n/i18n-context';
import type { IconName } from '../shared/ui/icon';
import { Icon } from '../shared/ui/icon';
import { LeafPage } from './leaf-page';

function HomeAction({
    to,
    icon,
    title,
    hint,
}: {
    to: string;
    icon: IconName;
    title: string;
    hint: string;
}) {
    return (
        <Link to={to} className="leaf-home__action">
            <Icon name={icon} size={28} />
            <span className="leaf-home__action-text">
                <span className="leaf-home__action-title">{title}</span>
                <span className="leaf-home__action-hint">{hint}</span>
            </span>
        </Link>
    );
}

// Mobile home: the two things Leaf is for, shopping and scanning.
export function HomePage() {
    const { t } = useI18n();

    return (
        <LeafPage
            eyebrow={t('leaf.home.eyebrow')}
            title={t('leaf.home.title')}
            intro={t('leaf.home.intro')}
        >
            <nav className="leaf-home__actions" aria-label={t('leaf.home.actions')}>
                <HomeAction
                    to="/collections"
                    icon="collections"
                    title={t('leaf.home.collections')}
                    hint={t('leaf.home.collectionsHint')}
                />
                <HomeAction
                    to="/scan"
                    icon="scan"
                    title={t('leaf.home.scan')}
                    hint={t('leaf.home.scanHint')}
                />
            </nav>
        </LeafPage>
    );
}
