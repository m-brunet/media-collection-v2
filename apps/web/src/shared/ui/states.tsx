import type { ReactNode } from 'react';
import type { IconName } from './icon';
import { Icon } from './icon';

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="state" role="status">
            <Icon name="loading" size={28} className="spin state__icon" />
            <p className="state__title">{label}</p>
        </div>
    );
}

export function EmptyState({
    icon = 'info',
    title,
    body,
    action,
}: {
    icon?: IconName;
    title: string;
    body?: string;
    action?: ReactNode;
}) {
    return (
        <div className="state">
            <Icon name={icon} size={28} className="state__icon" />
            <p className="state__title">{title}</p>
            {body && <p className="state__body">{body}</p>}
            {action}
        </div>
    );
}
