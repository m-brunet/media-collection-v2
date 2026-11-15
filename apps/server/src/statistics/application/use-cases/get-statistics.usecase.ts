import type { StatisticsView } from '../statistics-views.js';
import type { CollectionTallies } from '../ports/driven/collection-tallies.interface.js';
import type { LibraryStatisticsReader } from '../ports/driven/library-statistics-reader.interface.js';
import type { GetStatisticsUseCase } from '../ports/driving/get-statistics-use-case.interface.js';
import type { StatisticsCategory } from '../../domain/services/collection-progress.service.js';
import { CollectionProgress } from '../../domain/services/collection-progress.service.js';
import { Ranking } from '../../domain/services/ranking.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetStatistics implements GetStatisticsUseCase {
    constructor(
        private readonly library: LibraryStatisticsReader,
        private readonly collections: CollectionTallies,
    ) {}

    async execute(actor: Actor, category: StatisticsCategory | null): Promise<StatisticsView> {
        ActorAuthorization.requireReady(actor);
        const [totals, categories, publishers, authors, longest, mostExpensive, tallies] =
            await Promise.all([
                this.library.totals(category),
                this.library.categories(),
                this.library.publishers(category),
                this.library.authors(category),
                this.library.longest(category),
                this.library.mostExpensive(category),
                this.collections.all(),
            ]);
        const progress = CollectionProgress.of(tallies, category);

        return {
            ...totals,
            categories,
            reading: actor.role === 'guest' ? null : await this.library.reading(actor.id, category),
            publishers: {
                byBooks: Ranking.top(publishers.counts, (publisher) => publisher.books),
                byPages: Ranking.top(
                    publishers.counts.filter((publisher) => publisher.pages > 0),
                    (publisher) => publisher.pages,
                ),
                without: publishers.without,
                count: publishers.counts.length,
            },
            authors: {
                byBooks: Ranking.top(authors, (author) => author.books),
                byPages: Ranking.top(
                    authors.filter((author) => author.pages > 0),
                    (author) => author.pages,
                ),
            },
            records: {
                longest,
                mostExpensive,
                biggestCollection: progress.biggest && {
                    id: progress.biggest.id,
                    name: progress.biggest.name,
                    ownedBooks: progress.biggest.ownedBooks,
                },
            },
            collections: {
                finished: progress.finished,
                unfinished: progress.unfinished,
                missingVolumes: progress.missingVolumes,
            },
        };
    }
}
