import { useCallback } from 'react';
import type { TagDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import type { DraftTag } from '../../shared/book-form/book-draft.util';
import { NamePicker } from './name-picker';

export function TagPicker({
    tags,
    hint,
    error,
    onChange,
}: {
    tags: DraftTag[];
    hint?: string;
    error?: string;
    onChange(tags: DraftTag[]): void;
}) {
    const { t } = useI18n();
    const search = useCallback(
        (text: string) => api.request<TagDto[]>('/tags?search=' + encodeURIComponent(text)),
        [],
    );

    return (
        <NamePicker<DraftTag>
            label={t('tags.field')}
            hint={hint}
            error={error}
            placeholder={t('tags.findOrCreate')}
            values={tags}
            search={search}
            fromChoice={(tag) => ({ id: tag.id, name: tag.name })}
            fromName={(name) => ({ id: null, name })}
            newLabel={(name) => t('tags.createNamed', { name })}
            removeLabel={(name) => t('tags.remove', { name })}
            onChange={onChange}
        />
    );
}
