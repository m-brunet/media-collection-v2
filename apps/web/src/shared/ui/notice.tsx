import type { ReactNode } from 'react';
import type { IconName } from './icon';
import { Icon } from './icon';

type Tone = 'info' | 'success' | 'error' | 'warning';

const icons: Record<Tone, IconName> = {
    info: 'info',
    success: 'success',
    error: 'error',
    warning: 'info',
};

export function Notice({
    tone = 'info',
    icon,
    children,
}: {
    tone?: Tone;
    icon?: IconName;
    children: ReactNode;
}) {
    return (
        <div className={'notice notice--' + tone} role={tone === 'error' ? 'alert' : 'status'}>
            <Icon name={icon ?? icons[tone]} size={18} className="notice__icon" />
            <div>{children}</div>
        </div>
    );
}
