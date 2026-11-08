import { useI18n } from '../i18n/i18n-context';
import { Icon } from './icon';

// Product name as shown in the interface: "Libris" or "Leaf", with "by Media Collection" beneath.
export function Brand({
    app,
    size = 'medium',
}: {
    app: 'libris' | 'leaf';
    size?: 'medium' | 'large';
}) {
    const { t } = useI18n();
    const markSize = size === 'large' ? 30 : 24;

    return (
        <div className={'brand brand--' + size}>
            {app === 'libris' ? (
                // The official Libris icon, also the favicon and the desktop window icon. It keeps its
                // Spring green whatever the colour scheme or icon set.
                <img
                    src="/libris.svg"
                    alt=""
                    width={markSize}
                    height={markSize}
                    className="brand__mark"
                />
            ) : (
                <Icon name="brand" size={markSize} className="brand__mark" />
            )}
            <div className="brand__text">
                <span className="brand__name">
                    {t(app === 'libris' ? 'brand.libris' : 'brand.leaf')}
                </span>
                <span className="brand__byline">{t('brand.byline')}</span>
            </div>
        </div>
    );
}
