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

    return (
        <div className={'brand brand--' + size}>
            <Icon name="brand" size={size === 'large' ? 30 : 24} className="brand__mark" />
            <div className="brand__text">
                <span className="brand__name">
                    {t(app === 'libris' ? 'brand.libris' : 'brand.leaf')}
                </span>
                <span className="brand__byline">{t('brand.byline')}</span>
            </div>
        </div>
    );
}
