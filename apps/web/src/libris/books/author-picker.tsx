import { useEffect, useId, useState } from 'react';
import type { AuthorDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import type { DraftAuthor } from './book-draft.util';
import { BookDraft } from './book-draft.util';

type Option = { kind: 'existing'; author: AuthorDto } | { kind: 'new'; name: string };

// Chooses the book's authors: existing ones are suggested while typing; Enter adds the typed name
// as a new author (the server then reuses an equivalent one or asks about a similar one).
export function AuthorPicker({
    authors,
    onChange,
    onCorrect,
    error,
}: {
    authors: DraftAuthor[];
    onChange(authors: DraftAuthor[]): void;
    // Offered for saved authors: correct the shared spelling.
    onCorrect?(author: AuthorDto): void;
    error?: string;
}) {
    const { t } = useI18n();
    const id = useId();
    const [typed, setTyped] = useState('');
    const [found, setFound] = useState<{ key: string; authors: AuthorDto[] }>({
        key: '',
        authors: [],
    });
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const typedKey = BookDraft.nameKey(typed);
    // Suggestions found for an earlier text are never offered for the current one.
    const suggestions = typedKey && found.key === typedKey ? found.authors : [];
    const chosen = new Set(authors.map((author) => author.id ?? BookDraft.nameKey(author.name)));
    const options: Option[] = [
        ...suggestions
            .filter((author) => !chosen.has(author.id))
            .map((author): Option => ({ kind: 'existing', author })),
        ...(typedKey &&
        !chosen.has(typedKey) &&
        !suggestions.some((author) => BookDraft.nameKey(author.name) === typedKey)
            ? [{ kind: 'new', name: typed.trim() } as Option]
            : []),
    ];
    const expanded = open && options.length > 0;

    useEffect(() => {
        if (!typedKey) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<AuthorDto[]>('/authors?search=' + encodeURIComponent(typed.trim())).then(
                (authors) => current && setFound({ key: typedKey, authors }),
                () => current && setFound({ key: typedKey, authors: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [typed, typedKey]);

    const choose = (option: Option) => {
        onChange([
            ...authors,
            option.kind === 'existing'
                ? { id: option.author.id, name: option.author.name, distinct: false }
                : { id: null, name: option.name, distinct: false },
        ]);
        setTyped('');
        setActive(0);
        setOpen(false);
    };

    return (
        <div className="field">
            <span id={id + '-label'} className="field__label">
                {t('form.authors')}
                <span aria-hidden="true"> *</span>
            </span>
            <div
                role="group"
                aria-labelledby={id + '-label'}
                className={'author-picker' + (error ? ' author-picker--invalid' : '')}
            >
                <ul className="author-picker__chips">
                    {authors.map((author, index) => (
                        <li key={(author.id ?? 'new') + '-' + author.name} className="chip">
                            <span>{author.name}</span>
                            {author.id && onCorrect && (
                                <button
                                    type="button"
                                    className="chip__button"
                                    aria-label={t('form.authorCorrect', { name: author.name })}
                                    onClick={() => onCorrect({ id: author.id!, name: author.name })}
                                >
                                    <Icon name="edit" size={14} />
                                </button>
                            )}
                            <button
                                type="button"
                                className="chip__button"
                                aria-label={t('form.authorRemove', { name: author.name })}
                                onClick={() =>
                                    onChange(authors.filter((_, position) => position !== index))
                                }
                            >
                                <Icon name="close" size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="author-picker__input">
                    <input
                        role="combobox"
                        aria-label={t('form.authorPlaceholder')}
                        aria-expanded={expanded}
                        aria-controls={id + '-options'}
                        aria-autocomplete="list"
                        aria-activedescendant={expanded ? id + '-option-' + active : undefined}
                        aria-describedby={id + '-hint' + (error ? ' ' + id + '-error' : '')}
                        aria-invalid={error ? true : undefined}
                        placeholder={'+ ' + t('form.authorPlaceholder')}
                        className="author-picker__control"
                        value={typed}
                        maxLength={200}
                        onChange={(event) => {
                            setTyped(event.target.value);
                            setActive(0);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown' && options.length > 0) {
                                event.preventDefault();
                                setOpen(true);
                                setActive((active + 1) % options.length);
                            } else if (event.key === 'ArrowUp' && options.length > 0) {
                                event.preventDefault();
                                setActive((active - 1 + options.length) % options.length);
                            } else if (event.key === 'Enter') {
                                event.preventDefault();

                                if (expanded && options[active]) {
                                    choose(options[active]);
                                }
                            } else if (event.key === 'Escape' && expanded) {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpen(false);
                            }
                        }}
                    />
                    <ul
                        id={id + '-options'}
                        role="listbox"
                        aria-label={t('form.authors')}
                        className="author-picker__options"
                        hidden={!expanded}
                    >
                        {options.map((option, index) => (
                            <li
                                key={option.kind === 'existing' ? option.author.id : 'new'}
                                id={id + '-option-' + index}
                                role="option"
                                aria-selected={index === active}
                                className="author-picker__option"
                                // Keeps focus in the input so the list does not close first.
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => choose(option)}
                            >
                                {option.kind === 'existing'
                                    ? option.author.name
                                    : t('form.authorNew', { name: option.name })}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <p id={id + '-hint'} className="field__hint">
                {t('form.authorsHint')}
            </p>
            {error && (
                <p id={id + '-error'} className="field__error">
                    {error}
                </p>
            )}
        </div>
    );
}
