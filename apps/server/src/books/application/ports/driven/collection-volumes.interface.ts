import type { BookCategory } from '../../../domain/entities/book.entity.js';

export type CollectionVolumeMember = {
    bookId: string;
    volumeFrom: number;
    volumeTo: number;
    isbn: string | null;
};

export type CollectionVolumesView = {
    id: string;
    name: string;
    category: BookCategory;
    members: CollectionVolumeMember[];
    uncovered: number[];
};

export interface CollectionVolumes {
    of(collectionId: string, upTo: number): Promise<CollectionVolumesView>;
}
