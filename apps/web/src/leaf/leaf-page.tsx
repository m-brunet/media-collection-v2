import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiErrorMessage } from '../shared/api-error-message.util';
import { useI18n } from '../shared/i18n/i18n-context';
import { Button } from '../shared/ui/button';
import { Icon } from '../shared/ui/icon';
import { Notice } from '../shared/ui/notice';

export function LeafPage({
    back,
    eyebrow,
    title,
    intro,
    children,
}: {
    back?: { to: string; label: string };
    eyebrow?: string;
    title: string;
    intro?: string;
    children?: ReactNode;
}) {
    return (
        <section className="leaf__section">
            {back && (
                <Link to={back.to} className="leaf__back">
                    <Icon name="back" size={16} />
                    <span>{back.label}</span>
                </Link>
            )}
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="leaf__title">{title}</h1>
            {intro && <p className="muted">{intro}</p>}
            {children}
        </section>
    );
}

export function LeafLoadFailure({ error, onRetry }: { error: unknown; onRetry(): void }) {
    const { t } = useI18n();

    return (
        <>
            <Notice tone="error">{t(ApiErrorMessage.key(error))}</Notice>
            <Button onClick={onRetry}>{t('leaf.retry')}</Button>
        </>
    );
}
