import type { BookcaseDto, ShelfDto } from '../../../../../packages/contracts/src/http';
import type { LocationEditing } from './location-dialogs';

export interface LocationSelection {
    bookcase?: string;
    shelf?: string;
    keepShelf?: boolean;
}

export interface BookshelvesViewProps {
    bookcases: BookcaseDto[];
    bookcase: BookcaseDto;
    shelf: ShelfDto | null;
    editor: boolean;
    onSelect(selected: LocationSelection): void;
    onEdit(editing: LocationEditing): void;
    onChanged(message: string): void;
    onReload(): void;
}
