import type { KeyboardEvent } from 'react';
import { useId, useState } from 'react';

export function useTooltip(active: boolean) {
    const id = useId();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const open = active && (hovered || focused) && !dismissed;

    return {
        id,
        open,
        anchor: {
            onMouseEnter: () => {
                setDismissed(false);
                setHovered(true);
            },
            onMouseLeave: () => setHovered(false),
        },
        trigger: {
            'aria-describedby': active ? id : undefined,
            onFocus: () => {
                setDismissed(false);
                setFocused(true);
            },
            onBlur: () => setFocused(false),
            onKeyDown: (event: KeyboardEvent) => {
                if (open && event.key === 'Escape') {
                    event.preventDefault();
                    setDismissed(true);
                }
            },
        },
    };
}
