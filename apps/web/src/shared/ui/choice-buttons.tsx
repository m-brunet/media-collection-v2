import { useId } from 'react';

export interface Choice<T extends string> {
    value: T;
    label: string;
}

export function ChoiceButtons<T extends string>({
    label,
    value,
    choices,
    disabled = false,
    hint,
    onChange,
}: {
    label: string;
    value: T;
    choices: readonly Choice<T>[];
    disabled?: boolean;
    hint?: string;
    onChange(value: T): void;
}) {
    const name = useId();

    return (
        <fieldset
            className="field choice-buttons"
            disabled={disabled}
            aria-describedby={hint ? name + '-hint' : undefined}
        >
            <legend className="field__label">{label}</legend>
            <div className="choice-buttons__options">
                {choices.map((choice) => (
                    <label
                        key={choice.value}
                        className={[
                            'button',
                            'button--secondary',
                            'choice-buttons__option',
                            choice.value === value ? 'button--pressed' : null,
                        ]
                            .filter(Boolean)
                            .join(' ')}
                    >
                        <input
                            type="radio"
                            className="visually-hidden"
                            name={name}
                            value={choice.value}
                            checked={choice.value === value}
                            onChange={() => onChange(choice.value)}
                        />
                        <span>{choice.label}</span>
                    </label>
                ))}
            </div>
            {hint && (
                <p id={name + '-hint'} className="field__hint">
                    {hint}
                </p>
            )}
        </fieldset>
    );
}
