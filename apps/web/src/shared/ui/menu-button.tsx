import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { IconName } from './icon';
import { Icon } from './icon';

export interface MenuAction {
    label: string;
    icon?: IconName;
    danger?: boolean;
    onSelect(): void;
}

const moves: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowDown: (index, last) => (index === last ? 0 : index + 1),
    ArrowUp: (index, last) => (index === 0 ? last : index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

export function MenuButton({ label, actions }: { label: string; actions: readonly MenuAction[] }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const items = useRef<(HTMLButtonElement | null)[]>([]);
    const close = (refocus: boolean) => {
        setOpen(false);

        if (refocus) {
            trigger.current?.focus();
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        items.current[0]?.focus();

        const outside = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', outside);

        return () => document.removeEventListener('mousedown', outside);
    }, [open]);

    const move = (event: KeyboardEvent, index: number) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close(true);

            return;
        }

        if (event.key === 'Tab') {
            setOpen(false);

            return;
        }

        const next = moves[event.key]?.(index, actions.length - 1);

        if (next !== undefined) {
            event.preventDefault();
            items.current[next]?.focus();
        }
    };

    return (
        <div ref={root} className="menu-button">
            <button
                ref={trigger}
                type="button"
                className="icon-button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(!open)}
            >
                <Icon name="more" size={18} />
            </button>
            {open && (
                <div id={menuId} role="menu" aria-label={label} className="menu-button__menu">
                    {actions.map((action, index) => (
                        <button
                            key={action.label}
                            ref={(item) => {
                                items.current[index] = item;
                            }}
                            type="button"
                            role="menuitem"
                            tabIndex={-1}
                            className={
                                action.danger
                                    ? 'menu-button__item menu-button__item--danger'
                                    : 'menu-button__item'
                            }
                            onKeyDown={(event) => move(event, index)}
                            onClick={() => {
                                close(false);
                                action.onSelect();
                            }}
                        >
                            {action.icon && <Icon name={action.icon} size={16} />}
                            <span>{action.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
