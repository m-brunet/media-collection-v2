import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';

export interface SelectOption {
    value: string;
    label: string;
}

export function SelectField({
    label,
    hint,
    options,
    required,
    ...select
}: {
    label: string;
    hint?: string;
    options: SelectOption[];
    required?: boolean;
} & SelectHTMLAttributes<HTMLSelectElement>) {
    const id = useId();

    return (
        <div className="field">
            <label htmlFor={id} className="field__label">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            <select
                {...select}
                id={id}
                required={required}
                aria-describedby={hint ? id + '-hint' : undefined}
                className="field__control field__control--select"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hint && (
                <p id={id + '-hint'} className="field__hint">
                    {hint}
                </p>
            )}
        </div>
    );
}
