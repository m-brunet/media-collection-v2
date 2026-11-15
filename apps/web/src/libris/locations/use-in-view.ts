import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useInView(element: RefObject<HTMLElement | null>): boolean {
    const [seen, setSeen] = useState(typeof IntersectionObserver === 'undefined');

    useEffect(() => {
        const target = element.current;

        if (seen || !target) {
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setSeen(true);
            }
        });

        observer.observe(target);

        return () => observer.disconnect();
    }, [element, seen]);

    return seen;
}
