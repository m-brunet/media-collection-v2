import { useI18n } from '../i18n/i18n-context';
import leafMark from './marks/leaf-mark.svg?raw';
import librisMark from './marks/libris-mark.svg?raw';

const marks = { libris: librisMark, leaf: leafMark };

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
            <span
                className="brand__mark"
                data-mark={app}
                style={{ width: markSize, height: markSize }}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: marks[app] }}
            />
            <div className="brand__text">
                <span className="brand__name">
                    {t(app === 'libris' ? 'brand.libris' : 'brand.leaf')}
                </span>
                <span className="brand__byline">{t('brand.byline')}</span>
            </div>
        </div>
    );
}
