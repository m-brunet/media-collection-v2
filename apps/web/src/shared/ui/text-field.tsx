import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

interface FieldProps {
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
}

// Labelled input with optional hint and error, wired for assistive technology.
export function TextField({
    label,
    hint,
    error,
    required,
    className,
    ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
    const id = useId();
    const describedBy = [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ');

    return (
        <div className={['field', className].filter(Boolean).join(' ')}>
            <label htmlFor={id} className="field__label">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            <input
                {...input}
                id={id}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                className="field__control"
            />
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

export function TextAreaField({
    label,
    hint,
    required,
    ...input
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const id = useId();

    return (
        <div className="field">
            <label htmlFor={id} className="field__label">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            <textarea
                {...input}
                id={id}
                required={required}
                aria-describedby={hint ? id + '-hint' : undefined}
                className="field__control field__control--multiline"
            />
            {hint && (
                <p id={id + '-hint'} className="field__hint">
                    {hint}
                </p>
            )}
        </div>
    );
}
