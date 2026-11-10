import { useState } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';

export function BookCover({
    src,
    title,
    size = 'medium',
}: {
    src: string | null;
    title: string;
    size?: 'small' | 'medium' | 'large';
}) {
    const { t } = useI18n();
    const [failed, setFailed] = useState<string | null>(null);

    return (
        <div className={'book-cover book-cover--' + size}>
            {src && failed !== src ? (
                <img
                    className="book-cover__image"
                    src={src}
                    alt={t('cover.alt', { title })}
                    onError={() => setFailed(src)}
                />
            ) : (
                <div className="book-cover__fallback">
                    <Icon name="cover-missing" size={size === 'small' ? 20 : 28} />
                    <span>{t('cover.missing')}</span>
                </div>
            )}
        </div>
    );
}
