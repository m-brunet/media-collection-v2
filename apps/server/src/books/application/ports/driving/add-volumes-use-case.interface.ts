import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { Ownership } from '../../../domain/entities/book.entity.js';

export type VolumeToAdd = {
    volume: number;
    isbn: string;
    ownership: Ownership;
    title: string | null;
    authors: string[];
    publicationYear: number | null;
    pageCount: number | null;
    summary: string | null;
};

export type VolumesRequest = {
    collectionId: string;
    anchorBookId: string;
    volumes: VolumeToAdd[];
};

export type VolumeSkipReason = 'volume-taken' | 'isbn-taken';

export type VolumesAdded = {
    added: { bookId: string; volume: number; title: string }[];
    skipped: { volume: number; isbn: string; reason: VolumeSkipReason }[];
};

export interface AddVolumesUseCase {
    execute(actor: Actor, request: VolumesRequest): Promise<VolumesAdded>;
}
