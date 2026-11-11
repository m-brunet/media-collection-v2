import { useEffect, useMemo, useRef, useState } from 'react';
import type { LookupCoverDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { CoverChoice } from '../../shared/book-form/cover-choice';
import { CoverFile } from '../../shared/book-form/cover-file.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { TextField } from '../../shared/ui/text-field';

export function LeafCoverField({
    isbn,
    covers,
    choice,
    onChange,
}: {
    isbn: string;
    covers: LookupCoverDto[];
    choice: CoverChoice;
    onChange(choice: CoverChoice): void;
}) {
    const { t } = useI18n();
    const input = useRef<HTMLInputElement>(null);
    const [address, setAddress] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chosenToken, setChosenToken] = useState<string | null>(covers[0]?.token ?? null);
    const preview = useMemo(
        () => (choice.file ? URL.createObjectURL(choice.file) : null),
        [choice.file],
    );
    const canPaste = typeof navigator.clipboard?.readText === 'function';

    useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

    const accept = (file: Blob) => {
        if (CoverFile.problem(file) === 'format') {
            setError(t('reason.coverFormat'));
        } else if (CoverFile.problem(file) === 'size') {
            setError(t('reason.coverTooLarge'));
        } else {
            setError(null);
            onChange({ file: new File([file], 'cover', { type: file.type }), removed: false });

            return true;
        }

        return false;
    };
    const fetchImage = async (token: string | null, load: () => Promise<Blob>) => {
        setBusy(true);
        setError(null);

        try {
            if (accept(await load())) {
                setChosenToken(token);
                setAddress('');
            }
        } catch (failure) {
            setError(t(ApiErrorMessage.key(failure)));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="leaf-cover">
            <span className="field__label">{t('form.cover')}</span>
            <div className="leaf-cover__preview">
                {preview ? (
                    <img src={preview} alt={t('leaf.cover.chosen')} />
                ) : (
                    <span className="leaf-cover__empty">
                        <Icon name="cover-missing" size={28} />
                        {t('form.coverNone')}
                    </span>
                )}
            </div>
            {covers.length > 0 && (
                <fieldset className="leaf-cover__found">
                    <legend className="field__label">{t('leaf.cover.found')}</legend>
                    {covers.map((cover, index) => (
                        <button
                            key={cover.token}
                            type="button"
                            className="leaf-cover__option"
                            aria-pressed={chosenToken === cover.token}
                            disabled={busy}
                            onClick={() =>
                                void fetchImage(cover.token, () =>
                                    api.download('/books/lookups/covers/' + cover.token),
                                )
                            }
                        >
                            <img
                                src={'/api/books/lookups/covers/' + cover.token}
                                alt={t('leaf.cover.option', { number: index + 1 })}
                            />
                        </button>
                    ))}
                </fieldset>
            )}
            <a
                className="button button--secondary"
                href={'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(isbn)}
                target="_blank"
                rel="noreferrer"
            >
                <Icon name="search" size={16} />
                <span>
                    {t('cover.search')} <span className="visually-hidden">{t('cover.newTab')}</span>
                </span>
            </a>
            <TextField
                label={t('cover.address')}
                hint={t('leaf.cover.addressHint')}
                value={address}
                inputMode="url"
                onChange={(event) => setAddress(event.target.value)}
            />
            <div className="leaf-cover__actions">
                {canPaste && (
                    <Button
                        onClick={() =>
                            void navigator.clipboard
                                .readText()
                                .then((text) => setAddress(text.trim()))
                                .catch(() => setError(t('leaf.cover.pasteFailed')))
                        }
                    >
                        {t('leaf.cover.paste')}
                    </Button>
                )}
                <Button
                    variant="primary"
                    busy={busy}
                    disabled={!address.trim()}
                    onClick={() =>
                        void fetchImage(null, () =>
                            api.download('/books/lookups/covers', { address: address.trim() }),
                        )
                    }
                >
                    {t('cover.addressUse')}
                </Button>
            </div>
            <input
                ref={input}
                className="visually-hidden"
                type="file"
                accept={CoverFile.types.join(',')}
                aria-label={t('leaf.cover.photos')}
                tabIndex={-1}
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    event.target.value = '';

                    if (file && accept(file)) {
                        setChosenToken(null);
                    }
                }}
            />
            <Button icon="cover-add" onClick={() => input.current?.click()}>
                {t('leaf.cover.photos')}
            </Button>
            {choice.file && (
                <Button
                    variant="ghost"
                    onClick={() => {
                        setChosenToken(null);
                        onChange({ file: null, removed: true });
                    }}
                >
                    {t('form.coverRemove')}
                </Button>
            )}
            {error && (
                <p className="field__error" role="alert">
                    {error}
                </p>
            )}
            <p className="field__hint">{t('form.coverHint')}</p>
        </div>
    );
}
