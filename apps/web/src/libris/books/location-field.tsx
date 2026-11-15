import { Link } from 'react-router';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import type { ShelfPlace } from '../../shared/book-form/shelf-select';
import { ShelfSelect } from '../../shared/book-form/shelf-select';
import { useI18n } from '../../shared/i18n/i18n-context';

export function LocationField({
    bookcases,
    shelfId,
    error,
    required = false,
    onChange,
}: {
    bookcases: BookcaseDto[];
    shelfId: string | null;
    error?: string;
    required?: boolean;
    onChange(place: ShelfPlace): void;
}) {
    const { t } = useI18n();

    if (!bookcases.some((bookcase) => bookcase.shelves.length > 0)) {
        return (
            <p className="muted">
                {t('location.noneYet')} <Link to="/bookshelves">{t('location.manage')}</Link>
            </p>
        );
    }

    return (
        <ShelfSelect
            bookcases={bookcases}
            shelfId={shelfId}
            required={required}
            hint={required ? undefined : t('location.chooseHint')}
            error={error}
            onChange={onChange}
        />
    );
}
