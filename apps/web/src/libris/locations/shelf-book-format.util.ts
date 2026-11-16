import type { BookListItemDto } from '../../../../../packages/contracts/src/http';

export class ShelfBookFormat {
    static collection(book: Pick<BookListItemDto, 'collection'>, none: string): string {
        if (!book.collection) {
            return none;
        }

        const { name, volumeFrom, volumeTo } = book.collection;

        return name + ' · ' + (volumeFrom === volumeTo ? volumeFrom : volumeFrom + '–' + volumeTo);
    }
}
