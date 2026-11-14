import { useId } from 'react';
import type { CollectionNameDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SelectField } from '../../shared/ui/select-field';
import { TextField } from '../../shared/ui/text-field';
import type { BookDraftValues } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';

type CollectionValues = Pick<
    BookDraftValues,
    'inCollection' | 'collectionName' | 'collectionDistinct' | 'omnibus' | 'volumeFrom' | 'volumeTo'
>;

export function CollectionField({
    values,
    suggestions,
    error,
    onChange,
}: {
    values: CollectionValues;
    suggestions: readonly CollectionNameDto[];
    error?: string;
    onChange(changes: Partial<BookDraftValues>): void;
}) {
    const { t } = useI18n();
    const id = useId();

    return (
        <div className="form collection-field">
            <label className="checkbox">
                <input
                    type="checkbox"
                    checked={values.inCollection}
                    onChange={(event) => onChange({ inCollection: event.target.checked })}
                />
                {t('form.inCollection')}
            </label>
            {!values.inCollection && <p className="muted">{t('form.inCollectionHint')}</p>}
            {values.inCollection && (
                <>
                    <TextField
                        label={t('form.collectionName')}
                        required
                        maxLength={200}
                        autoComplete="off"
                        placeholder={t('form.collectionPlaceholder')}
                        list={id + '-collections'}
                        value={values.collectionName}
                        onChange={(event) =>
                            onChange({
                                collectionName: event.target.value,
                                collectionDistinct:
                                    values.collectionDistinct &&
                                    BookDraft.nameKey(event.target.value) ===
                                        BookDraft.nameKey(values.collectionName),
                            })
                        }
                    />
                    <datalist id={id + '-collections'}>
                        {suggestions.map((collection) => (
                            <option key={collection.id} value={collection.name} />
                        ))}
                    </datalist>
                    <div className="book-form__row">
                        <SelectField
                            label={t('form.coverage')}
                            required
                            value={values.omnibus ? 'range' : 'single'}
                            options={[
                                { value: 'single', label: t('form.coverageSingle') },
                                { value: 'range', label: t('form.coverageRange') },
                            ]}
                            onChange={(event) =>
                                onChange({ omnibus: event.target.value === 'range' })
                            }
                        />
                        <TextField
                            label={values.omnibus ? t('form.volumeFrom') : t('form.volume')}
                            required
                            inputMode="numeric"
                            maxLength={4}
                            value={values.volumeFrom}
                            onChange={(event) => onChange({ volumeFrom: event.target.value })}
                        />
                        {values.omnibus && (
                            <TextField
                                label={t('form.volumeTo')}
                                required
                                inputMode="numeric"
                                maxLength={4}
                                value={values.volumeTo}
                                onChange={(event) => onChange({ volumeTo: event.target.value })}
                            />
                        )}
                    </div>
                    {error && <p className="field__error">{error}</p>}
                    <p className="muted">{t('form.coverageHint')}</p>
                </>
            )}
        </div>
    );
}
