import { useI18n } from '../i18n/i18n-context';
import leafMark from './marks/leaf-mark.svg?raw';
import librisMark from './marks/libris-mark.svg?raw';

// The application marks next to the name (decided 2026-11-09): one fixed drawing each, the Libris
// icon and the hand-inked Turning leaf for Leaf, drawn in the text colour so they take the colour
// scheme's accent (`.brand__mark`). The favicons, Leaf's home-screen icon and the desktop icon stay
// Spring green (apps/web/public/libris.svg and leaf.svg).
const marks = { libris: librisMark, leaf: leafMark };

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
            <span
                className="brand__mark"
                data-mark={app}
                style={{ width: markSize, height: markSize }}
                aria-hidden="true"
                // Trusted artwork shipped with the app, never user data.
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
