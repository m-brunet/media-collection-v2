import type { BookcaseDto, BookLocationDto } from '../../../../../packages/contracts/src/http';

// How physical locations read in the interface.
export class LocationFormat {
    // "Oak bookcase – Shelf 3": a location is always a shelf within its bookcase.
    static label(location: Pick<BookLocationDto, 'bookcaseName' | 'shelfName'>): string {
        return location.bookcaseName + ' – ' + location.shelfName;
    }

    // The location of a shelf among the loaded bookcases, or null when it is unknown.
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

    // A location filter choice (`bookcase:<id>` or `shelf:<id>`) as it reads, "…" while its
    // bookcases are not loaded; null for `none`.
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
