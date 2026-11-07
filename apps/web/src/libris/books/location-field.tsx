import { Link } from 'react-router';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { SelectField } from '../../shared/ui/select-field';
import type { BookDraftValues } from '../../shared/book-form/book-draft.util';

// Physical location in the book form: a bookcase, then one of its shelves. Locations are created
// on the Bookshelves page beforehand; a bookcase alone is not a location.
export function LocationField({
    bookcases,
    bookcaseId,
    shelfId,
    error,
    onChange,
}: {
    bookcases: BookcaseDto[];
    bookcaseId: string | null;
    shelfId: string | null;
    error?: string;
    onChange(changes: Pick<BookDraftValues, 'bookcaseId' | 'shelfId'>): void;
}) {
    const { t } = useI18n();
    const bookcase = bookcases.find((candidate) => candidate.id === bookcaseId);

    if (bookcases.length === 0) {
        return (
            <p className="muted">
                {t('location.noneYet')} <Link to="/bookshelves">{t('location.manage')}</Link>
            </p>
        );
    }

    return (
        <div className="form">
            <div className="book-form__row book-form__row--two">
                <SelectField
                    label={t('location.bookcase')}
                    value={bookcaseId ?? ''}
                    options={[
                        { value: '', label: t('location.unassigned') },
                        ...bookcases.map((choice) => ({ value: choice.id, label: choice.name })),
                    ]}
                    onChange={(event) =>
                        onChange({ bookcaseId: event.target.value || null, shelfId: null })
                    }
                />
                <SelectField
                    label={t('location.shelf')}
                    required={bookcase !== undefined}
                    disabled={!bookcase}
                    value={shelfId ?? ''}
                    options={[
                        { value: '', label: t('location.unassigned') },
                        ...(bookcase?.shelves ?? []).map((shelf) => ({
                            value: shelf.id,
                            label: shelf.name,
                        })),
                    ]}
                    onChange={(event) =>
                        onChange({ bookcaseId, shelfId: event.target.value || null })
                    }
                />
            </div>
            {error && <p className="field__error">{error}</p>}
            <p className="muted">{t('location.shelfOnly')}</p>
        </div>
    );
}
