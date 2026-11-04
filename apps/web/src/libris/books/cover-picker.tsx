import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { BookCover } from './book-cover';

const types = ['image/jpeg', 'image/png', 'image/webp'];
const limit = 10 * 1024 * 1024;

// The cover choice of the form: kept locally and uploaded only when the book is saved.
export interface CoverChoice {
    file: File | null;
    removed: boolean;
}

export function CoverPicker({
    title,
    savedCover,
    choice,
    onChange,
}: {
    title: string;
    // Address of the book's current cover, if it has one.
    savedCover: string | null;
    choice: CoverChoice;
    onChange(choice: CoverChoice): void;
}) {
    const { t } = useI18n();
    const input = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const preview = useMemo(
        () => (choice.file ? URL.createObjectURL(choice.file) : null),
        [choice.file],
    );
    const shown = preview ?? (choice.removed ? null : savedCover);

    useEffect(
        () => () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        },
        [preview],
    );

    return (
        <div className="cover-picker">
            <p className="field__label">{t('form.cover')}</p>
            {shown ? (
                <BookCover src={shown} title={title} />
            ) : (
                <div className="cover-picker__empty">
                    <BookCover src={null} title={title} />
                    <span className="visually-hidden">{t('form.coverNone')}</span>
                </div>
            )}
            <input
                ref={input}
                type="file"
                accept={types.join(',')}
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    event.target.value = '';

                    if (!file) {
                        return;
                    }

                    if (!types.includes(file.type)) {
                        setError(t('reason.coverFormat'));
                    } else if (file.size > limit) {
                        setError(t('reason.coverTooLarge'));
                    } else {
                        setError(null);
                        onChange({ file, removed: false });
                    }
                }}
            />
            <div className="cover-picker__actions">
                <Button icon="cover-add" onClick={() => input.current?.click()}>
                    {shown ? t('form.coverChange') : t('form.coverChoose')}
                </Button>
                {shown && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setError(null);
                            onChange({ file: null, removed: true });
                        }}
                    >
                        {t('form.coverRemove')}
                    </Button>
                )}
            </div>
            <p className="field__hint">{t('form.coverHint')}</p>
            {error && (
                <p className="field__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
