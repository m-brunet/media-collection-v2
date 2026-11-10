import type { BookcaseDto, BookLocationDto } from '../../../../../packages/contracts/src/http';

export class LocationFormat {
    static label(location: Pick<BookLocationDto, 'bookcaseName' | 'shelfName'>): string {
        return location.bookcaseName + ' – ' + location.shelfName;
    }

    static of(bookcases: readonly BookcaseDto[], shelfId: string): BookLocationDto | null {
        for (const bookcase of bookcases) {
            const shelf = bookcase.shelves.find((candidate) => candidate.id === shelfId);

            if (shelf) {
                return {
                    bookcaseId: bookcase.id,
                    bookcaseName: bookcase.name,
                    shelfId: shelf.id,
                    shelfName: shelf.name,
                };
            }
        }

        return null;
    }

    static choice(bookcases: readonly BookcaseDto[], value: string): string | null {
        const [kind, id] = value.split(':');

        if (kind === 'bookcase') {
            return bookcases.find((bookcase) => bookcase.id === id)?.name ?? '…';
        }

        if (kind === 'shelf' && id) {
            const location = LocationFormat.of(bookcases, id);

            return location ? LocationFormat.label(location) : '…';
        }

        return null;
    }
}
