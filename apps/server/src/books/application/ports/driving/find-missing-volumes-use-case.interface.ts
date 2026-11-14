import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookCategory } from '../../../domain/entities/book.entity.js';

export type MissingVolumeEdition = {
    isbn13: string;
    title: string | null;
    subtitle: string | null;
    authors: string[];
    publisher: string | null;
    publicationYear: number | null;
    pageCount: number | null;
    summary: string | null;
    inLibrary: boolean;
};

export type MissingVolumeRow = {
    volume: number;
    generatedTitle: string | null;
    editions: MissingVolumeEdition[];
};

export type MissingVolumes =
    | {
          kind: 'found';
          collection: { id: string; name: string; category: BookCategory };
          anchor: { bookId: string; volume: number };
          series: string;
          rows: MissingVolumeRow[];
      }
    | { kind: 'edition-not-found' }
    | { kind: 'unavailable'; retryAt: string | null };

export interface FindMissingVolumesUseCase {
    execute(actor: Actor, collectionId: string, upTo: number): Promise<MissingVolumes>;
}
