import type {
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';

export type WallSlot =
    | { kind: 'book'; book: CollectionMemberDto }
    | { kind: 'missing'; volume: number };

export class CollectionCovers {
    static books(collection: CollectionDetailsDto): CollectionMemberDto[] {
        const books = new Map<string, CollectionMemberDto>();

        for (const volume of collection.volumes) {
            for (const book of volume.books) {
                books.set(book.id, book);
            }
        }

        return [...books.values()].sort(
            (first, second) =>
                first.volumeFrom - second.volumeFrom || first.title.localeCompare(second.title),
        );
    }

    static slots(collection: CollectionDetailsDto): WallSlot[] {
        const books = CollectionCovers.books(collection).map((book): WallSlot => ({
            kind: 'book',
            book,
        }));
        const missing = collection.volumes
            .filter((volume) => volume.state === 'inferred')
            .flatMap((volume) =>
                Array.from({ length: volume.to - volume.from + 1 }, (_, index): WallSlot => ({
                    kind: 'missing',
                    volume: volume.from + index,
                })),
            );

        return [...books, ...missing].sort(
            (first, second) => CollectionCovers.position(first) - CollectionCovers.position(second),
        );
    }

    static volumes(book: CollectionMemberDto): string {
        return book.volumeFrom === book.volumeTo
            ? String(book.volumeFrom)
            : book.volumeFrom + '–' + book.volumeTo;
    }

    static hue(book: CollectionMemberDto): number {
        return (book.volumeFrom * 47 + 200) % 360;
    }

    private static position(slot: WallSlot): number {
        return slot.kind === 'book' ? slot.book.volumeFrom : slot.volume;
    }
}
