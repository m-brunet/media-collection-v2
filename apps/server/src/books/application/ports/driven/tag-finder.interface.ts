import type { BookTag } from './book-tag-reader.interface.js';

export interface TagFinder {
    find(tagIds: readonly string[]): Promise<BookTag[]>;
}
