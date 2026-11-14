import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n-context';
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
    onClose,
}: {
    tone?: Tone;
    icon?: IconName;
    children: ReactNode;
    onClose?(): void;
}) {
    const { t } = useI18n();

    return (
        <div className={'notice notice--' + tone} role={tone === 'error' ? 'alert' : 'status'}>
            <Icon name={icon ?? icons[tone]} size={18} className="notice__icon" />
            <div className="notice__body">{children}</div>
            {onClose && (
                <button
                    type="button"
                    className="icon-button notice__close"
                    aria-label={t('notice.close')}
                    onClick={onClose}
                >
                    <Icon name="close" size={16} />
                </button>
            )}
        </div>
    );
}
