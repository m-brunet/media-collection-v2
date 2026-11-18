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
import type { PublisherMatcher } from '../services/publisher-matcher.service.js';
import type {
    SeriesFinding,
    SeriesSearch,
    SeriesUnavailable,
} from '../services/series-search.service.js';
import type { OwnedVolume, VolumeEdition } from '../../domain/services/series-volumes.service.js';
import type { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import type { PublisherNames } from '../../domain/value-objects/publisher-names.value-object.js';
import { GeneratedTitle } from '../../domain/value-objects/generated-title.value-object.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import { VolumeAdmission } from '../volume-admission.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';
import { Required } from '../../../shared/domain/required.helper.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FindMissingVolumes implements FindMissingVolumesUseCase {
    static readonly maximumVolumes = 200;
    static readonly maximumAnchors = 50;

    constructor(
        private readonly collections: CollectionVolumes,
        private readonly series: SeriesSearch,
        private readonly books: BookRepository,
        private readonly authors: AuthorMatcher,
        private readonly publishers: PublisherMatcher,
    ) {}

    async execute(
        actor: Actor,
        collectionId: string,
        upTo: number,
        signal?: AbortSignal,
    ): Promise<MissingVolumes> {
        ActorAuthorization.requireLibraryEditor(actor);
        const collection = await this.collections.of(collectionId, upTo);

        VolumeAdmission.ensureOpen(collection);

        Failure.ensure(
            collection.uncovered.length <= FindMissingVolumes.maximumVolumes,
            'Add at most ' + FindMissingVolumes.maximumVolumes + ' volumes at once.',
            'volumes-too-many',
        );
        const owned = FindMissingVolumes.owned(collection.members);

        if (owned.length === 0) {
            return { kind: 'edition-not-found' };
        }

        const { anchor, found, unavailable } = await this.series.find(
            owned,
            collection.uncovered,
            signal,
        );

        if (unavailable.length > 0 && (!anchor || found.size === 0)) {
            return FindMissingVolumes.without(unavailable);
        }

        if (!anchor) {
            return { kind: 'edition-not-found' };
        }

        return {
            kind: 'found',
            collection: { id: collection.id, name: collection.name, category: collection.category },
            anchor: {
                bookId: FindMissingVolumes.anchorBook(collection, anchor.edition),
                volume: anchor.edition.volume,
            },
            series: anchor.edition.answer.series?.name ?? '',
            catalogues: [
                ...new Set([anchor.source, ...[...found.values()].map(({ source }) => source)]),
            ],
            unavailable: unavailable.map(({ name }) => name),
            rows: await this.rows(collection, found),
        };
    }

    private async rows(
        collection: CollectionVolumesView,
        findings: ReadonlyMap<number, SeriesFinding>,
    ) {
        const found = collection.uncovered.map((volume) => ({
            volume,
            source: findings.get(volume)?.source ?? null,
            editions: findings.get(volume)?.editions ?? [],
        }));
        const names = [
            ...new Set(found.flatMap((row) => row.editions.flatMap((e) => e.answer.authors))),
        ];
        const existing = await this.authors.existing(names);
        const publishers = await this.publishers.names();
        const rows = [];

        for (const row of found) {
            const editions: MissingVolumeEdition[] = [];

            for (const edition of row.editions) {
                editions.push(await this.edition(edition, existing, publishers));
            }

            rows.push({
                volume: row.volume,
                source: row.source,
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
        publishers: PublisherNames,
    ): Promise<MissingVolumeEdition> {
        const answer = edition.answer.withPublishers(
            (publisher) => publishers.same(publisher) ?? publisher,
        );

        return {
            isbn13: edition.isbn13,
            title: answer.title,
            subtitle: edition.subtitle,
            authors: answer.authors.map((name) => existing.get(name) ?? name),
            publishers: FindMissingVolumes.publishers(answer),
            publicationYear: answer.publicationDate?.year ?? null,
            pageCount: answer.pageCount,
            summary: answer.summary?.text ?? null,
            inLibrary: (await this.books.findByIsbn(edition.isbn13)) !== null,
        };
    }

    private static publishers(answer: LookupAnswer): string[] {
        const names = [answer.publisher, answer.publisherCollection].filter(
            (name): name is string => name !== null,
        );

        return names.filter(
            (name, index) =>
                names.findIndex((other) => NameKey.words(other) === NameKey.words(name)) === index,
        );
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

    private static without(unavailable: readonly SeriesUnavailable[]): MissingVolumes {
        const latest = unavailable
            .flatMap(({ retryAt }) => (retryAt ? [retryAt.getTime()] : []))
            .sort((a, b) => b - a)[0];

        return {
            kind: 'unavailable',
            catalogues: unavailable.map(({ name }) => name),
            retryAt: latest === undefined ? null : new Date(latest).toISOString(),
        };
    }
}
