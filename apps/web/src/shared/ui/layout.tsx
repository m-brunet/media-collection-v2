import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export function PageHeader({
    title,
    intro,
    breadcrumb,
    actions,
}: {
    title: string;
    intro?: string;
    breadcrumb?: ReactNode;
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
                {breadcrumb && <div className="page-header__intro">{breadcrumb}</div>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </header>
    );
}

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
