import { useId } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../i18n/i18n-context';

export interface ShelfPlace {
    bookcaseId: string | null;
    shelfId: string | null;
}

export function ShelfSelect({
    bookcases,
    shelfId,
    label,
    hint,
    error,
    required = false,
    onChange,
}: {
    bookcases: readonly BookcaseDto[];
    shelfId: string | null;
    label?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    onChange(place: ShelfPlace): void;
}) {
    const { t } = useI18n();
    const id = useId();
    const described = [hint ? id + '-hint' : null, error ? id + '-error' : null]
        .filter(Boolean)
        .join(' ');

    return (
        <div className="field">
            <label htmlFor={id} className="field__label">
                {label ?? t('location.label')}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            <select
                id={id}
                className="field__control field__control--select"
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={described || undefined}
                value={shelfId ?? ''}
                onChange={(event) => {
                    const chosen = event.target.value || null;
                    const bookcase = bookcases.find((candidate) =>
                        candidate.shelves.some((shelf) => shelf.id === chosen),
                    );

                    onChange({ bookcaseId: bookcase?.id ?? null, shelfId: chosen });
                }}
            >
                {required ? (
                    <option value="" disabled>
                        {t('location.choosePlaceholder')}
                    </option>
                ) : (
                    <option value="">{t('location.unassigned')}</option>
                )}
                {bookcases
                    .filter((bookcase) => bookcase.shelves.length > 0)
                    .map((bookcase) => (
                        <optgroup key={bookcase.id} label={bookcase.name}>
                            {bookcase.shelves.map((shelf) => (
                                <option key={shelf.id} value={shelf.id}>
                                    {bookcase.name + ' – ' + shelf.name}
                                </option>
                            ))}
                        </optgroup>
                    ))}
            </select>
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
