import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    // Shown but not selectable, for a choice the current state does not allow.
    disabled?: boolean;
}

export function SelectField({
    label,
    hint,
    options,
    placeholder,
    required,
    ...select
}: {
    label: string;
    hint?: string;
    options: SelectOption[];
    // Shown first and not selectable again, so a required choice cannot be left to a default.
    placeholder?: string;
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
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
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
