import type {
    FindMissingVolumesUseCase,
    MissingVolumeEdition,
    MissingVolumes,
} from '../ports/driving/find-missing-volumes-use-case.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type {
    CollectionVolumeMember,
    CollectionVolumes,
    CollectionVolumesView,
} from '../ports/driven/collection-volumes.interface.js';
import type { AuthorMatcher } from '../services/author-matcher.service.js';
import type { SeriesLookup, SeriesReply } from '../services/series-lookup.service.js';
import type { OwnedVolume, VolumeEdition } from '../../domain/services/series-volumes.service.js';
import { SeriesVolumes } from '../../domain/services/series-volumes.service.js';
import { GeneratedTitle } from '../../domain/value-objects/generated-title.value-object.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { Required } from '../../../shared/domain/required.helper.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FindMissingVolumes implements FindMissingVolumesUseCase {
    static readonly maximumVolumes = 200;
    static readonly maximumAnchors = 50;

    constructor(
        private readonly collections: CollectionVolumes,
        private readonly series: SeriesLookup,
        private readonly books: BookRepository,
        private readonly authors: AuthorMatcher,
    ) {}

    async execute(actor: Actor, collectionId: string, upTo: number): Promise<MissingVolumes> {
        ActorAuthorization.requireLibraryEditor(actor);
        const collection = await this.collections.of(collectionId, upTo);

        Failure.ensure(
            collection.uncovered.length <= FindMissingVolumes.maximumVolumes,
            'Add at most ' + FindMissingVolumes.maximumVolumes + ' volumes at once.',
            'volumes-too-many',
        );
        const owned = FindMissingVolumes.owned(collection.members);

        if (owned.length === 0) {
            return { kind: 'edition-not-found' };
        }

        const editions = await this.series.editions(owned.map((volume) => volume.isbn13));

        if (editions.kind !== 'found') {
            return FindMissingVolumes.without(editions);
        }

        const anchor = SeriesVolumes.anchorOf(editions.value, owned);

        if (!anchor?.answer.series || !anchor.answer.publisher) {
            return { kind: 'edition-not-found' };
        }

        const records = await this.series.volumes(
            anchor.answer.series.name,
            anchor.answer.publisher,
        );

        if (records.kind === 'limited' || records.kind === 'failed') {
            return FindMissingVolumes.without(records);
        }

        const volumes = SeriesVolumes.of(anchor, records.kind === 'found' ? records.value : []);

        return {
            kind: 'found',
            collection: { id: collection.id, name: collection.name, category: collection.category },
            anchor: {
                bookId: FindMissingVolumes.anchorBook(collection, anchor),
                volume: anchor.volume,
            },
            series: volumes.series,
            rows: await this.rows(collection, volumes),
        };
    }

    private async rows(collection: CollectionVolumesView, volumes: SeriesVolumes) {
        const found = collection.uncovered.map((volume) => ({
            volume,
            editions: volumes.editions(volume),
        }));
        const names = [
            ...new Set(found.flatMap((row) => row.editions.flatMap((e) => e.answer.authors))),
        ];
        const existing = await this.authors.existing(names);
        const rows = [];

        for (const row of found) {
            const editions: MissingVolumeEdition[] = [];

            for (const edition of row.editions) {
                editions.push(await this.edition(edition, existing));
            }

            rows.push({
                volume: row.volume,
                generatedTitle:
                    collection.category === 'books'
                        ? null
                        : GeneratedTitle.of(collection.name, row.volume, row.volume).text,
                editions,
            });
        }

        return rows;
    }

    private async edition(
        edition: VolumeEdition,
        existing: ReadonlyMap<string, string>,
    ): Promise<MissingVolumeEdition> {
        const { answer } = edition;

        return {
            isbn13: edition.isbn13,
            title: answer.title,
            subtitle: edition.subtitle,
            authors: answer.authors.map((name) => existing.get(name) ?? name),
            publisher: answer.publisher,
            publicationYear: answer.publicationDate?.year ?? null,
            pageCount: answer.pageCount,
            summary: answer.summary?.text ?? null,
            inLibrary: (await this.books.findByIsbn(edition.isbn13)) !== null,
        };
    }

    private static owned(members: readonly CollectionVolumeMember[]): OwnedVolume[] {
        return members
            .flatMap((member) => {
                const isbn13 = member.isbn ? Isbn.equivalent(member.isbn) : null;

                return isbn13 ? [{ isbn13, volume: member.volumeTo }] : [];
            })
            .sort((a, b) => b.volume - a.volume)
            .slice(0, FindMissingVolumes.maximumAnchors);
    }

    private static anchorBook(collection: CollectionVolumesView, anchor: VolumeEdition): string {
        const member = collection.members.find(
            (candidate) => candidate.isbn && Isbn.equivalent(candidate.isbn) === anchor.isbn13,
        );

        return Required.value(member, 'the anchor is a member of the collection').bookId;
    }

    private static without(reply: Exclude<SeriesReply, { kind: 'found' }>): MissingVolumes {
        return reply.kind === 'none'
            ? { kind: 'edition-not-found' }
            : {
                  kind: 'unavailable',
                  retryAt:
                      reply.kind === 'limited' && reply.retryAt
                          ? reply.retryAt.toISOString()
                          : null,
              };
    }
}
