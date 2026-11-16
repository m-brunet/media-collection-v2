import type { SeriesEntry } from '../../../domain/services/series-volumes.service.js';
import type { SourceReply, SourceTurn } from './lookup-source.interface.js';

export type SeriesRecord = SeriesEntry;

export type SeriesPage = { records: readonly SeriesRecord[]; next: number | null };

export interface SeriesCatalogue {
    readonly name: string;
    editions(isbn13s: readonly string[], turn: SourceTurn): Promise<SourceReply<SeriesRecord[]>>;
    volumes(
        series: string,
        publisher: string,
        start: number,
        turn: SourceTurn,
    ): Promise<SourceReply<SeriesPage>>;
}
