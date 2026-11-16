export type PillTone = 'on' | 'off' | 'warn';

export function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
    return (
        <span className={'status-pill status-pill--' + tone}>
            <span className="status-pill__dot" aria-hidden="true" />
            {label}
        </span>
    );
}
