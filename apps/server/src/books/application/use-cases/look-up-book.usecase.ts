import type {
    BookLookup,
    LookUpBookUseCase,
} from '../ports/driving/look-up-book-use-case.interface.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import type { AuthorMatcher, AuthorSpelling } from '../services/author-matcher.service.js';
import type { SourceLink, SourceUnavailability } from '../services/source-chain.service.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import { CoverCombination } from '../../domain/services/cover-combination.service.js';
import { LookupCombination } from '../../domain/services/lookup-combination.service.js';
import type { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class LookUpBook implements LookUpBookUseCase {
    constructor(
        private readonly books: BookRepository,
        // The book information sources and the cover sources, each in order of preference.
        private readonly information: SourceLink<LookupAnswer> | null,
        private readonly covers: SourceLink<CoverOffer[]> | null,
        private readonly registry: LookupCoverRegistry,
        private readonly authors: AuthorMatcher,
    ) {}

    async execute(actor: Actor, isbn: string): Promise<BookLookup> {
        ActorAuthorization.requireLibraryEditor(actor);
        const { isbn13 } = Isbn.parse(isbn);
        const existing = await this.books.findByIsbn(isbn13);

        if (existing) {
            return { kind: 'existing', bookId: existing.snapshot.id };
        }

        const answers: { source: string; answer: LookupAnswer }[] = [];
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
                found: (source, answer) => answers.push({ source, answer }),
                unavailable: report,
            }),
            coverSteps?.handle({
                found: (source, offers) => covers.add(source, offers),
                unavailable: report,
            }),
        ]);

        const { fields, authorSpellings } = await this.combined(answers);
        const coverChoices = covers.result();

        return {
            kind: 'looked-up',
            isbn13,
            found: fields.found || coverChoices.length > 0,
            fields: fields.result(),
            authorSpellings,
            covers: coverChoices.map(({ address, width, height, sources }) => ({
                token: this.registry.register(address),
                width,
                height,
                sources,
            })),
            unavailable,
        };
    }

    // The answers in order of preference, each author an existing author has a name for named
    // that way: the form then links the book to that author instead of offering a new one.
    private async combined(answers: { source: string; answer: LookupAnswer }[]) {
        const fields = new LookupCombination();
        const names = [...new Set(answers.flatMap(({ answer }) => answer.authors))];
        const existing = await this.authors.existing(names);
        const authorSpellings: AuthorSpelling[] = [];

        for (const { source, answer } of answers) {
            fields.add(
                source,
                answer.withAuthors(answer.authors.map((name) => existing.get(name) ?? name)),
            );
        }

        for (const [spelling, name] of existing) {
            if (NameKey.of(spelling) !== NameKey.of(name)) {
                authorSpellings.push({
                    name,
                    spelling,
                    sources: answers
                        .filter(({ answer }) => answer.authors.includes(spelling))
                        .map(({ source }) => source),
                });
            }
        }

        return { fields, authorSpellings };
    }
}
