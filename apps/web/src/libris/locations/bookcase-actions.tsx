import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import type { LocationEditing } from './location-dialogs';

export function BookcaseActions({
    bookcase,
    className,
    onEdit,
}: {
    bookcase: BookcaseDto;
    className: string;
    onEdit(editing: LocationEditing): void;
}) {
    const { t } = useI18n();

    return (
        <div className={'actions ' + className}>
            <Button icon="add" onClick={() => onEdit({ kind: 'create-shelf', bookcase })}>
                {t('shelf.add')}
            </Button>
            <Button icon="edit" onClick={() => onEdit({ kind: 'rename-bookcase', bookcase })}>
                {t('bookcase.rename')}
            </Button>
            <Button
                variant="danger"
                icon="delete"
                onClick={() => onEdit({ kind: 'delete-bookcase', bookcase })}
            >
                {t('bookcase.delete')}
            </Button>
        </div>
    );
}
