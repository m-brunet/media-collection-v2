import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookLocation } from '../driven/book-location-reader.interface.js';

export type ShelfPlacementRequest = { shelfId: string; bookIds: readonly string[] };

export type PlacedBook = { id: string; title: string };

export type ShelfPlacementView = {
    shelf: BookLocation;
    placed: PlacedBook[];
    moved: (PlacedBook & { from: BookLocation })[];
    unchanged: PlacedBook[];
};

export interface PlaceBooksOnShelfUseCase {
    execute(actor: Actor, request: ShelfPlacementRequest): Promise<ShelfPlacementView>;
}
