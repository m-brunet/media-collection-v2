import type { KeyboardEvent } from 'react';
import { useId, useState } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { Suggestion } from './suggestion-list.util';

export function LeafSuggestedField({
    label,
    required,
    error,
    value,
    suggestions,
    onChange,
    onChoose,
    onEnter,
}: {
    label: string;
    required?: boolean;
    error?: string;
    value: string;
    suggestions: readonly Suggestion[];
    onChange(value: string): void;
    onChoose(suggestion: Suggestion): void;
    onEnter?(): void;
}) {
    const { t } = useI18n();
    const id = useId();
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [active, setActive] = useState<string | null>(null);
    const open = focused && !dismissed && suggestions.length > 0;
    const current = open ? suggestions.findIndex((suggestion) => suggestion.key === active) : -1;
    const option = (key: string) => id + '-option-' + key;
    const choose = (suggestion: Suggestion) => {
        setActive(null);
        setDismissed(true);
        onChoose(suggestion);
    };
    const move = (step: number) => {
        const next = suggestions[(current + step + suggestions.length) % suggestions.length];

        setActive(next?.key ?? null);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const chosen = suggestions[current];

        if (event.key === 'ArrowDown' && open) {
            event.preventDefault();
            move(1);
        } else if (event.key === 'ArrowUp' && open) {
            event.preventDefault();
            move(current < 0 ? 0 : -1);
        } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setActive(null);
            setDismissed(true);
        } else if (event.key === 'Enter' && chosen) {
            event.preventDefault();
            choose(chosen);
        } else if (event.key === 'Enter' && onEnter) {
            event.preventDefault();
            onEnter();
        }
    };

    return (
        <div className="field leaf-suggested">
            <label htmlFor={id} className="field__label">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            <input
                id={id}
                type="text"
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={open ? id + '-list' : undefined}
                aria-activedescendant={current >= 0 && active ? option(active) : undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? id + '-error' : undefined}
                required={required}
                className="field__control"
                value={value}
                onChange={(event) => {
                    setDismissed(false);
                    setActive(null);
                    onChange(event.target.value);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false);
                    setActive(null);
                }}
                onKeyDown={onKeyDown}
            />
            {open && (
                <ul
                    id={id + '-list'}
                    role="listbox"
                    aria-label={t('leaf.form.suggestions', { field: label })}
                    className="leaf-suggested__list"
                >
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.key}
                            id={option(suggestion.key)}
                            role="option"
                            aria-selected={suggestion.key === active}
                            className="leaf-suggested__option"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(suggestion)}
                        >
                            {suggestion.label}
                        </li>
                    ))}
                </ul>
            )}
            {error && (
                <p id={id + '-error'} className="field__error">
                    {error}
                </p>
            )}
        </div>
    );
}
