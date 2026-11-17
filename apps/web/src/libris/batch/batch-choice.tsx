import { useId } from 'react';

export function BatchChoice<T extends string>({
    labelledBy,
    value,
    choices,
    onChange,
}: {
    labelledBy: string;
    value: T | null;
    choices: { value: T; label: string }[];
    onChange(value: T): void;
}) {
    const name = useId();

    return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="segmented batch-choice">
            {choices.map((choice) => (
                <label key={choice.value} className="segmented__option segmented__option--include">
                    <input
                        type="radio"
                        name={name}
                        className="visually-hidden"
                        checked={choice.value === value}
                        onChange={() => onChange(choice.value)}
                    />
                    {choice.label}
                </label>
            ))}
        </div>
    );
}
