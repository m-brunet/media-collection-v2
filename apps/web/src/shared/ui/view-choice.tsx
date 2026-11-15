import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { MessageKey } from '../i18n/catalog-en';
import { useI18n } from '../i18n/i18n-context';
import { Required } from '../required.util';
import type { IconName } from './icon';
import { Icon } from './icon';

export interface ViewEntry {
    id: string;
    label: MessageKey;
    icon: IconName;
}

class ViewMemory {
    static read(key: string): string | null {
        try {
            return window.localStorage.getItem(key);
        } catch {
            // Justified: the browser may refuse storage; the page then opens on the default view.
            return null;
        }
    }

    static write(key: string, view: string): void {
        try {
            window.localStorage.setItem(key, view);
        } catch {
            // Justified: the browser may refuse storage; the chosen view still applies to this visit.
        }
    }
}

const moves: Partial<Record<string, (index: number, last: number) => number>> = {
    ArrowRight: (index, last) => (index === last ? 0 : index + 1),
    ArrowDown: (index, last) => (index === last ? 0 : index + 1),
    ArrowLeft: (index, last) => (index === 0 ? last : index - 1),
    ArrowUp: (index, last) => (index === 0 ? last : index - 1),
    Home: () => 0,
    End: (_, last) => last,
};

function ViewChoiceBar({
    views,
    value,
    onChange,
}: {
    views: readonly ViewEntry[];
    value: string;
    onChange(id: string): void;
}) {
    const { t } = useI18n();
    const labelId = useId();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const move = (event: KeyboardEvent, index: number) => {
        const next = moves[event.key]?.(index, views.length - 1);
        const entry = next === undefined ? undefined : views[next];

        if (next === undefined || !entry) {
            return;
        }

        event.preventDefault();
        buttons.current[next]?.focus();
        onChange(entry.id);
    };

    return (
        <div className="view-choice">
            <span id={labelId} className="view-choice__label">
                {t('views.label')}
            </span>
            <div role="radiogroup" aria-labelledby={labelId} className="view-choice__options">
                {views.map((entry, index) => (
                    <button
                        key={entry.id}
                        ref={(button) => {
                            buttons.current[index] = button;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={entry.id === value}
                        tabIndex={entry.id === value ? 0 : -1}
                        className="view-choice__option"
                        onKeyDown={(event) => move(event, index)}
                        onClick={() => onChange(entry.id)}
                    >
                        <Icon name={entry.icon} size={16} />
                        <span>{t(entry.label)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function useViewChoice<V extends ViewEntry>(
    views: readonly V[],
    remembered: string,
): { view: V; choice: ReactNode } {
    const [parameters, setParameters] = useSearchParams();
    const wanted = parameters.get('view') ?? ViewMemory.read(remembered);
    const view =
        views.find((entry) => entry.id === wanted) ??
        Required.at(views, 0, 'a page offers at least one view');
    const choose = (id: string) => {
        const next = new URLSearchParams(parameters);

        ViewMemory.write(remembered, id);
        next.set('view', id);
        setParameters(next, { replace: true });
    };

    return {
        view,
        choice:
            views.length > 1 ? (
                <ViewChoiceBar views={views} value={view.id} onChange={choose} />
            ) : undefined,
    };
}
