import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { MessageKey } from '../i18n/catalog-en';
import { useI18n } from '../i18n/i18n-context';
import { Required } from '../required.util';
import { ChoiceButtons } from './choice-buttons';
import type { IconName } from './icon';

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

export function useViewChoice<V extends ViewEntry>(
    views: readonly V[],
    remembered: string,
): { view: V; choice: ReactNode } {
    const { t } = useI18n();
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
                <ChoiceButtons
                    label={t('views.label')}
                    value={view.id}
                    choices={views.map((entry) => ({
                        value: entry.id,
                        label: t(entry.label),
                        icon: entry.icon,
                    }))}
                    onChange={choose}
                />
            ) : undefined,
    };
}
