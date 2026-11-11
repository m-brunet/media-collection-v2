import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookCategory, Ownership } from '../../../domain/entities/book.entity.js';

export type ImportedBook = {
    title: string;
    isbn: string | null;
    authors: string[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    pageCount: number | null;
    price: string | null;
    collection: { name: string; volume: number } | null;
    createdAt: string;
    read: boolean;
    cover: Uint8Array | null;
};

export type ImportedBookOutcome = {
    bookId: string;
    title: string;
    collectionId: string | null;
    cover: 'stored' | 'none' | 'rejected';
};

export interface ImportBookUseCase {
    execute(actor: Actor, book: ImportedBook): Promise<ImportedBookOutcome>;
}
