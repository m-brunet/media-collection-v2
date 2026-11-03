import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { IconName } from './icon';
import { Icon } from './icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
    variant = 'secondary',
    icon,
    busy = false,
    children,
    className,
    type = 'button',
    disabled,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    icon?: IconName;
    busy?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            {...rest}
            type={type}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
            className={['button', 'button--' + variant, className].filter(Boolean).join(' ')}
        >
            {busy ? (
                <Icon name="loading" size={16} className="spin" />
            ) : (
                icon && <Icon name={icon} size={16} />
            )}
            <span>{children}</span>
        </button>
    );
}
