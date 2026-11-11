import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { NamedChoice } from '../books/name-picker';
import type { Filter, FilterKey } from './book-filter.util';
import { BookFilter } from './book-filter.util';
import { useChosenNames } from './use-chosen-names';

export interface ChoiceOption {
    value: string;
    label: string;
    nested?: boolean;
}

export function ChoiceField({
    label,
    hint,
    summary,
    options,
    filter,
    field,
    children,
    onChange,
}: {
    label: string;
    hint?: string;
    summary: string;
    options: ChoiceOption[];
    filter: Filter;
    field: FilterKey;
    children?: ReactNode;
    onChange(filter: Filter): void;
}) {
    const id = useId();

    return (
        <fieldset className="choice-field" aria-describedby={hint ? id + '-hint' : undefined}>
            <legend className="field__label">{label}</legend>
            <details className="choice-field__details">
                <summary className="field__control field__control--select choice-field__summary">
                    {summary}
                </summary>
                <div className="choice-field__panel">
                    {children}
                    {options.length > 0 && (
                        <ul className="choice-field__options">
                            {options.map((option) => (
                                <li
                                    key={option.value}
                                    className={option.nested ? 'choice-field__nested' : undefined}
                                >
                                    <label className="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={BookFilter.has(filter, field, option.value)}
                                            onChange={() =>
                                                onChange(
                                                    BookFilter.toggle(filter, field, option.value),
                                                )
                                            }
                                        />
                                        {option.label}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </details>
            {hint && (
                <p id={id + '-hint'} className="field__hint">
                    {hint}
                </p>
            )}
        </fieldset>
    );
}

export function SearchedChoices({
    label,
    hint,
    placeholder,
    anyLabel,
    fixed = [],
    field,
    filter,
    search,
    onChange,
}: {
    label: string;
    hint?: string;
    placeholder: string;
    anyLabel: string;
    fixed?: ChoiceOption[];
    field: 'author' | 'collection';
    filter: Filter;
    search(text: string): Promise<NamedChoice[]>;
    onChange(filter: Filter): void;
}) {
    const { t } = useI18n();
    const [typed, setTyped] = useState('');
    const [found, setFound] = useState<NamedChoice[]>([]);
    const chosen = filter[field].filter((value) => !fixed.some((option) => option.value === value));
    const known = useChosenNames(field, chosen);

    useEffect(() => {
        let current = true;
        const timer = setTimeout(() => {
            search(typed.trim()).then(
                (choices) => {
                    if (current) {
                        setFound(choices);
                    }
                },
                () => current && setFound([]),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [typed, search]);

    const name = (value: string) =>
        fixed.find((option) => option.value === value)?.label ??
        known.get(value) ??
        found.find((choice) => choice.id === value)?.name ??
        t(field === 'author' ? 'filters.someAuthor' : 'filters.someCollection');
    const options: ChoiceOption[] = [
        ...fixed,
        ...chosen.map((value) => ({ value, label: name(value) })),
        ...found
            .filter((choice) => !chosen.includes(choice.id))
            .map((choice) => ({ value: choice.id, label: choice.name })),
    ];
    const summary = filter[field].map(name).join(' · ') || anyLabel;

    return (
        <ChoiceField
            label={label}
            hint={hint}
            summary={summary}
            options={options}
            filter={filter}
            field={field}
            onChange={onChange}
        >
            <label className="visually-hidden" htmlFor={'filter-search-' + field}>
                {placeholder}
            </label>
            <input
                id={'filter-search-' + field}
                type="search"
                className="field__control"
                placeholder={placeholder}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
            />
        </ChoiceField>
    );
}

export function locationOptions(bookcases: BookcaseDto[], noLocation: string): ChoiceOption[] {
    return [
        { value: 'none', label: noLocation },
        ...bookcases.flatMap((bookcase) => [
            { value: 'bookcase:' + bookcase.id, label: bookcase.name },
            ...bookcase.shelves.map((shelf) => ({
                value: 'shelf:' + shelf.id,
                label: shelf.name,
                nested: true,
            })),
        ]),
    ];
}

export function searchAuthors(text: string): Promise<NamedChoice[]> {
    return api.request<NamedChoice[]>('/authors?search=' + encodeURIComponent(text));
}

export function searchCollections(text: string): Promise<NamedChoice[]> {
    return api.request<NamedChoice[]>('/collections/names?search=' + encodeURIComponent(text));
}
