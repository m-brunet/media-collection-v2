import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

// Page title block. The heading receives focus on navigation so screen-reader users hear the
// new page, as with a full page load.
export function PageHeader({
    title,
    intro,
    actions,
}: {
    title: string;
    intro?: string;
    actions?: ReactNode;
}) {
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        heading.current?.focus({ preventScroll: true });
    }, [title]);

    return (
        <header className="page-header">
            <div>
                <h1 ref={heading} tabIndex={-1} className="page-header__title">
                    {title}
                </h1>
                {intro && <p className="page-header__intro">{intro}</p>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </header>
    );
}

// Grouped content block with an optional small uppercase label (IBM Plex Mono in the design).
export function Panel({
    label,
    title,
    children,
    className,
}: {
    label?: string;
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={['panel', className].filter(Boolean).join(' ')}>
            {label && <p className="eyebrow">{label}</p>}
            {title && <h2 className="panel__title">{title}</h2>}
            {children}
        </section>
    );
}
