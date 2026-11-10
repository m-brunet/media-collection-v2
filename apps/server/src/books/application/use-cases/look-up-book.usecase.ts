import type {
    BookLookup,
    LookUpBookUseCase,
} from '../ports/driving/look-up-book-use-case.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import type { SourceLink, SourceUnavailability } from '../services/source-chain.service.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import { CoverCombination } from '../../domain/services/cover-combination.service.js';
import { LookupCombination } from '../../domain/services/lookup-combination.service.js';
import type { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class LookUpBook implements LookUpBookUseCase {
    constructor(
        private readonly books: BookRepository,
        // The book information sources and the cover sources, each in order of preference.
        private readonly information: SourceLink<LookupAnswer> | null,
        private readonly covers: SourceLink<CoverOffer[]> | null,
        private readonly registry: LookupCoverRegistry,
    ) {}

    async execute(actor: Actor, isbn: string): Promise<BookLookup> {
        ActorAuthorization.requireLibraryEditor(actor);
        const { isbn13 } = Isbn.parse(isbn);
        const existing = await this.books.findByIsbn(isbn13);

        if (existing) {
            return { kind: 'existing', bookId: existing.snapshot.id };
        }

        const fields = new LookupCombination();
        const covers = new CoverCombination();
        const unavailable: SourceUnavailability[] = [];
        const report = (unavailability: SourceUnavailability) => {
            if (!unavailable.some(({ source }) => source === unavailability.source)) {
                unavailable.push(unavailability);
            }
        };
        const informationSteps = this.information?.begin(isbn13);
        const coverSteps = this.covers?.begin(isbn13);

        await Promise.all([
            informationSteps?.handle({
                found: (source, answer) => fields.add(source, answer),
                unavailable: report,
            }),
            coverSteps?.handle({
                found: (source, offers) => covers.add(source, offers),
                unavailable: report,
            }),
        ]);

        const coverChoices = covers.result();

        return {
            kind: 'looked-up',
            isbn13,
            found: fields.found || coverChoices.length > 0,
            fields: fields.result(),
            covers: coverChoices.map(({ address, width, height, sources }) => ({
                token: this.registry.register(address),
                width,
                height,
                sources,
            })),
            unavailable,
        };
    }
}
