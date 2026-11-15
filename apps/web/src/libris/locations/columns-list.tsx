import { forwardRef } from 'react';
import type { KeyboardEvent } from 'react';

export interface ColumnsEntry {
    id: string;
    name: string;
    count: string;
}

const steps: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowDown: (index, last) => Math.min(last, index + 1),
    ArrowUp: (index) => Math.max(0, index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

export const ColumnsList = forwardRef<
    HTMLUListElement,
    {
        label: string;
        entries: readonly ColumnsEntry[];
        selected: string | null;
        onChoose(id: string): void;
        onLeave(side: 'previous' | 'next'): void;
    }
>(function ColumnsList({ label, entries, selected, onChoose, onLeave }, ref) {
    const chosen = Math.max(
        0,
        entries.findIndex((entry) => entry.id === selected),
    );
    const move = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            onLeave(event.key === 'ArrowLeft' ? 'previous' : 'next');

            return;
        }

        const next = steps[event.key]?.(index, entries.length - 1);
        const entry = next === undefined ? undefined : entries[next];

        if (!entry) {
            return;
        }

        event.preventDefault();
        (
            event.currentTarget.parentElement?.children[next ?? 0] as HTMLElement | undefined
        )?.focus();
        onChoose(entry.id);
    };

    return (
        <ul ref={ref} role="listbox" aria-label={label} className="columns-view__list">
            {entries.map((entry, index) => (
                <li
                    key={entry.id}
                    role="option"
                    aria-selected={entry.id === selected}
                    tabIndex={index === chosen ? 0 : -1}
                    className="columns-view__entry"
                    onClick={() => onChoose(entry.id)}
                    onKeyDown={(event) => move(event, index)}
                >
                    <span>{entry.name}</span>
                    <small>{entry.count}</small>
                </li>
            ))}
        </ul>
    );
});
