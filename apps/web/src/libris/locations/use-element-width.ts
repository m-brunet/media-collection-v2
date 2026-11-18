import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface ElementSize {
    width: number;
    height: number;
}

export function useElementSize(element: RefObject<HTMLElement | null>): ElementSize | null {
    const [size, setSize] = useState<ElementSize | null>(null);

    useEffect(() => {
        const target = element.current;

        if (!target || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            if (entry) {
                setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });

        observer.observe(target);

        return () => observer.disconnect();
    }, [element]);

    return size;
}

export function useElementWidth(element: RefObject<HTMLElement | null>): number | null {
    return useElementSize(element)?.width ?? null;
}
