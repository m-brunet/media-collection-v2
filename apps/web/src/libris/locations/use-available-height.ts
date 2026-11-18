import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useAvailableHeight(
    element: RefObject<HTMLElement | null>,
    bottomGap: number,
): number | null {
    const [height, setHeight] = useState<number | null>(null);

    useEffect(() => {
        const target = element.current;

        if (!target) {
            return;
        }

        const measure = () => {
            const top = target.getBoundingClientRect().top + window.scrollY;

            setHeight(window.innerHeight - top - bottomGap);
        };

        measure();
        window.addEventListener('resize', measure);

        return () => window.removeEventListener('resize', measure);
    }, [element, bottomGap]);

    return height;
}
