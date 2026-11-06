import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { TextField } from '../../shared/ui/text-field';
import { BookCover } from './book-cover';

const types = ['image/jpeg', 'image/png', 'image/webp'];
const limit = 10 * 1024 * 1024;

// The cover choice of the form: kept locally and uploaded only when the book is saved.
export interface CoverChoice {
    file: File | null;
    removed: boolean;
}

// Where to search for a cover: the ISBN, or the title and authors without one.
export function coverSearchAddress(terms: string): string {
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(terms);
}

// The cover of the form, chosen from a file, pasted (Ctrl+V outside text fields), dropped, or
// fetched from an image address; a web search helps find one (Task 6 cover helpers).
export function CoverPicker({
    title,
    savedCover,
    searchTerms,
    choice,
    onChange,
}: {
    title: string;
    // Address of the book's current cover, if it has one.
    savedCover: string | null;
    // What a web search for the cover looks for; empty when nothing identifies the book yet.
    searchTerms: string;
    choice: CoverChoice;
    onChange(choice: CoverChoice): void;
}) {
    const { t } = useI18n();
    const input = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState('');
    const [fetching, setFetching] = useState(false);
    const [dragging, setDragging] = useState(false);
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

    const accept = useCallback(
        (file: File) => {
            if (!types.includes(file.type)) {
                setError(t('reason.coverFormat'));
            } else if (file.size > limit) {
                setError(t('reason.coverTooLarge'));
            } else {
                setError(null);
                onChange({ file, removed: false });
            }
        },
        [onChange, t],
    );
    const fromAddress = async (value: string) => {
        setFetching(true);
        setError(null);

        try {
            const image = await api.download('/books/lookups/covers', { address: value.trim() });

            accept(new File([image], 'cover', { type: image.type }));
            setAddress('');
        } catch (failure) {
            setError(t(ApiErrorMessage.key(failure)));
        } finally {
            setFetching(false);
        }
    };
    const drop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
        // A picture dragged from a web page usually brings its address rather than a file.
        const link = (
            event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
        )
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => /^https?:\/\//i.test(line));

        if (file) {
            accept(file);
        } else if (link) {
            void fromAddress(link);
        }
    };

    // An image pasted anywhere in the page, except into a text field, becomes the cover.
    useEffect(() => {
        const paste = (event: ClipboardEvent) => {
            const target = event.target instanceof Element ? event.target : null;

            if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
                return;
            }

            const file = [...(event.clipboardData?.files ?? [])].find((item) =>
                item.type.startsWith('image/'),
            );

            if (file) {
                event.preventDefault();
                accept(file);
            }
        };

        document.addEventListener('paste', paste);

        return () => document.removeEventListener('paste', paste);
    }, [accept]);

    return (
        <div className="cover-picker">
            <p className="field__label">{t('form.cover')}</p>
            <div
                className={'cover-picker__drop' + (dragging ? ' cover-picker__drop--active' : '')}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
            >
                {shown ? (
                    <BookCover src={shown} title={title} />
                ) : (
                    <div className="cover-picker__empty">
                        <BookCover src={null} title={title} />
                        <span className="visually-hidden">{t('form.coverNone')}</span>
                    </div>
                )}
            </div>
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

                    if (file) {
                        accept(file);
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
            <p className="field__hint">{t('cover.pasteHint')}</p>
            {searchTerms.trim() && (
                <a
                    className="cover-picker__search"
                    href={coverSearchAddress(searchTerms.trim())}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Icon name="search" size={16} />
                    {t('cover.search')}
                    <span className="visually-hidden"> {t('cover.newTab')}</span>
                </a>
            )}
            <div className="cover-picker__address">
                <TextField
                    label={t('cover.address')}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    maxLength={2000}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter fetches the image instead of saving the whole form.
                        if (event.key === 'Enter') {
                            event.preventDefault();

                            if (address.trim()) {
                                void fromAddress(address);
                            }
                        }
                    }}
                />
                <Button
                    busy={fetching}
                    disabled={!address.trim()}
                    onClick={() => void fromAddress(address)}
                >
                    {t('cover.addressUse')}
                </Button>
            </div>
            {error && (
                <p className="field__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
