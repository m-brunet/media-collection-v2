import type { SpineBookView } from '../../location-views.js';

export interface BookcaseSpineReader {
    booksOn(shelfIds: readonly string[]): Promise<Map<string, SpineBookView[]>>;
}
