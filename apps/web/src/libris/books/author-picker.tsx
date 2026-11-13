import { useCallback } from 'react';
import type { AuthorDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import type { DraftAuthor } from '../../shared/book-form/book-draft.util';
import { NamePicker } from './name-picker';

export function AuthorPicker({
    authors,
    onChange,
    onCorrect,
    error,
}: {
    authors: DraftAuthor[];
    onChange(authors: DraftAuthor[]): void;
    onCorrect?(author: AuthorDto): void;
    error?: string;
}) {
    const { t } = useI18n();
    const search = useCallback(
        (text: string) => api.request<AuthorDto[]>('/authors?search=' + encodeURIComponent(text)),
        [],
    );

    return (
        <NamePicker<DraftAuthor>
            label={t('form.authors')}
            hint={t('form.authorsHint')}
            error={error}
            required
            placeholder={t('form.authorPlaceholder')}
            values={authors}
            search={search}
            fromChoice={(author) => ({ id: author.id, name: author.name, distinct: false })}
            fromName={(name) => ({ id: null, name, distinct: false })}
            newLabel={(name) => t('form.authorNew', { name })}
            removeLabel={(name) => t('form.authorRemove', { name })}
            chipActions={({ id, name }) =>
                id &&
                onCorrect && (
                    <button
                        type="button"
                        className="chip__button"
                        aria-label={t('form.authorCorrect', { name })}
                        onClick={() => onCorrect({ id, name })}
                    >
                        <Icon name="edit" size={14} />
                    </button>
                )
            }
            onChange={onChange}
        />
    );
}
