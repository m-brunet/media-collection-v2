import type {
    BookOwnership,
    MissingVolumeEditionDto,
    MissingVolumeRowDto,
    MissingVolumesDto,
    NewVolumesDto,
    VolumesAddedDto,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';

type Translate = (key: MessageKey, values?: MessageValues) => string;

export type FoundVolumes = Extract<MissingVolumesDto, { kind: 'found' }>;

export type VolumeChoice = {
    volume: number;
    ticked: boolean;
    isbn13: string | null;
    ownership: BookOwnership;
    sourceTitle: boolean;
};

export class VolumeReview {
    static choosable(row: MissingVolumeRowDto): MissingVolumeEditionDto[] {
        return row.editions.filter((edition) => !edition.inLibrary);
    }

    static initial(found: FoundVolumes): VolumeChoice[] {
        return found.rows.map((row) => {
            const edition = VolumeReview.choosable(row)[0] ?? null;

            return {
                volume: row.volume,
                ticked: edition !== null,
                isbn13: edition?.isbn13 ?? null,
                ownership: 'owned',
                sourceTitle: row.generatedTitle === null,
            };
        });
    }

    static edition(row: MissingVolumeRowDto, choice: VolumeChoice): MissingVolumeEditionDto | null {
        return row.editions.find((edition) => edition.isbn13 === choice.isbn13) ?? null;
    }

    static title(row: MissingVolumeRowDto, choice: VolumeChoice): string {
        const edition = VolumeReview.edition(row, choice);

        return (
            (choice.sourceTitle ? edition?.title : row.generatedTitle) ??
            row.generatedTitle ??
            edition?.title ??
            ''
        );
    }

    static chosen(found: FoundVolumes, choices: readonly VolumeChoice[]) {
        return found.rows.flatMap((row, index) => {
            const choice = choices[index];
            const edition = choice?.ticked ? VolumeReview.edition(row, choice) : null;

            return choice && edition ? [{ row, choice, edition }] : [];
        });
    }

    static request(found: FoundVolumes, choices: readonly VolumeChoice[]): NewVolumesDto {
        return {
            collectionId: found.collection.id,
            anchorBookId: found.anchor.bookId,
            volumes: VolumeReview.chosen(found, choices).map(({ row, choice, edition }) => ({
                volume: row.volume,
                isbn: edition.isbn13,
                ownership: choice.ownership,
                title: choice.sourceTitle || !row.generatedTitle ? edition.title : null,
                authors: edition.authors,
                publicationYear: edition.publicationYear,
                pageCount: edition.pageCount,
                summary: edition.summary,
            })),
        };
    }

    static report(
        name: string,
        result: VolumesAddedDto,
        coversFailed: boolean,
        t: Translate,
    ): string {
        const count = result.added.length;
        const reasons: Record<VolumesAddedDto['skipped'][number]['reason'], MessageKey> = {
            'volume-taken': 'volumes.reason.volumeTaken',
            'isbn-taken': 'volumes.reason.isbnTaken',
        };

        return [
            count === 0
                ? t('volumes.savedNone', { name })
                : count === 1
                  ? t('volumes.savedOne', { name })
                  : t('volumes.savedMany', { name, count }),
            ...result.skipped.map((skip) =>
                t('volumes.leftOut', { volume: skip.volume, reason: t(reasons[skip.reason]) }),
            ),
            coversFailed ? t('volumes.coversFailed') : null,
        ]
            .filter(Boolean)
            .join(' ');
    }

    static covers(found: FoundVolumes, choices: readonly VolumeChoice[]): string[] {
        return VolumeReview.chosen(found, choices).map(({ edition }) => edition.isbn13);
    }
}
