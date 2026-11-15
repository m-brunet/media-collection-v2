import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useElementWidth(element: RefObject<HTMLElement | null>): number | null {
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const target = element.current;

        if (!target || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(target);

        return () => observer.disconnect();
    }, [element]);

    return width;
}
