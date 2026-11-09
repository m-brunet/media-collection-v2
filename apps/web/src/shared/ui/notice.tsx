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

// Feedback message announced to assistive technology; errors interrupt, others are polite.
// The icon and wording carry the meaning, never the colour alone. `icon` names the situation
// (for example a camera that cannot be used) instead of the tone's icon.
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
