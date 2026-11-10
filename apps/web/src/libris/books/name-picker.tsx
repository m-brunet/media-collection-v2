import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { Icon } from '../../shared/ui/icon';
import { BookDraft } from '../../shared/book-form/book-draft.util';

export interface NamedChoice {
    id: string;
    name: string;
}

// A chosen value: an existing identity, or a typed name the server reuses or creates.
export interface NamedValue {
    id: string | null;
    name: string;
}

type Option = { kind: 'existing'; found: NamedChoice } | { kind: 'new'; name: string };

export function NamePicker<T extends NamedValue>({
    label,
    hint,
    error,
    required = false,
    placeholder,
    values,
    search,
    fromChoice,
    fromName,
    newLabel,
    removeLabel,
    chipActions,
    onChange,
}: {
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    placeholder: string;
    values: T[];
    search(text: string): Promise<NamedChoice[]>;
    fromChoice(choice: NamedChoice): T;
    fromName(name: string): T;
    newLabel(name: string): string;
    removeLabel(name: string): string;
    chipActions?(value: T): ReactNode;
    onChange(values: T[]): void;
}) {
    const id = useId();
    const [typed, setTyped] = useState('');
    const [found, setFound] = useState<{ key: string; choices: NamedChoice[] }>({
        key: '',
        choices: [],
    });
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const typedKey = BookDraft.nameKey(typed);
    // Suggestions found for an earlier text are never offered for the current one.
    const suggestions = typedKey && found.key === typedKey ? found.choices : [];
    const chosen = new Set(values.map((value) => value.id ?? BookDraft.nameKey(value.name)));
    const chosenKeys = new Set(values.map((value) => BookDraft.nameKey(value.name)));
    const options: Option[] = [
        ...suggestions
            .filter((choice) => !chosen.has(choice.id))
            .map((choice): Option => ({ kind: 'existing', found: choice })),
        ...(typedKey &&
        !chosenKeys.has(typedKey) &&
        !suggestions.some((choice) => BookDraft.nameKey(choice.name) === typedKey)
            ? [{ kind: 'new', name: typed.trim() } as Option]
            : []),
    ];
    const expanded = open && options.length > 0;
    const describedBy = [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ');

    useEffect(() => {
        if (!typedKey) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            search(typed.trim()).then(
                (choices) => current && setFound({ key: typedKey, choices }),
                () => current && setFound({ key: typedKey, choices: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [typed, typedKey, search]);

    const choose = (option: Option) => {
        onChange([
            ...values,
            option.kind === 'existing' ? fromChoice(option.found) : fromName(option.name),
        ]);
        setTyped('');
        setActive(0);
        setOpen(false);
    };

    return (
        <div className="field">
            <span id={id + '-label'} className="field__label">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </span>
            <div
                role="group"
                aria-labelledby={id + '-label'}
                className={'name-picker' + (error ? ' name-picker--invalid' : '')}
            >
                <ul className="name-picker__chips">
                    {values.map((value, index) => (
                        <li key={(value.id ?? 'new') + '-' + value.name} className="chip">
                            <span>{value.name}</span>
                            {chipActions?.(value)}
                            <button
                                type="button"
                                className="chip__button"
                                aria-label={removeLabel(value.name)}
                                onClick={() =>
                                    onChange(values.filter((_, position) => position !== index))
                                }
                            >
                                <Icon name="close" size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="name-picker__input">
                    <input
                        role="combobox"
                        aria-label={placeholder}
                        aria-expanded={expanded}
                        aria-controls={id + '-options'}
                        aria-autocomplete="list"
                        aria-activedescendant={expanded ? id + '-option-' + active : undefined}
                        aria-describedby={describedBy || undefined}
                        aria-invalid={error ? true : undefined}
                        placeholder={'+ ' + placeholder}
                        className="name-picker__control"
                        value={typed}
                        maxLength={200}
                        onChange={(event) => {
                            setTyped(event.target.value);
                            setActive(0);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown' && options.length > 0) {
                                event.preventDefault();
                                setOpen(true);
                                setActive((active + 1) % options.length);
                            } else if (event.key === 'ArrowUp' && options.length > 0) {
                                event.preventDefault();
                                setActive((active - 1 + options.length) % options.length);
                            } else if (event.key === 'Enter') {
                                event.preventDefault();

                                if (expanded && options[active]) {
                                    choose(options[active]);
                                }
                            } else if (event.key === 'Escape' && expanded) {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpen(false);
                            }
                        }}
                    />
                    <ul
                        id={id + '-options'}
                        role="listbox"
                        aria-label={label}
                        className="name-picker__options"
                        hidden={!expanded}
                    >
                        {options.map((option, index) => (
                            <li
                                key={option.kind === 'existing' ? option.found.id : 'new'}
                                id={id + '-option-' + index}
                                role="option"
                                aria-selected={index === active}
                                className="name-picker__option"
                                // Keeps focus in the input so the list does not close first.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => choose(option)}
                            >
                                {option.kind === 'existing'
                                    ? option.found.name
                                    : newLabel(option.name)}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {hint && (
                <p id={id + '-hint'} className="field__hint">
                    {hint}
                </p>
            )}
            {error && (
                <p id={id + '-error'} className="field__error">
                    {error}
                </p>
            )}
        </div>
    );
}
