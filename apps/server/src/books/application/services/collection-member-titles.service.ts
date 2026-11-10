import { BookAudit } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { Book } from '../../domain/entities/book.entity.js';
import type {
    MemberTitles,
    TitledMember,
} from '../../../collections/application/ports/driven/member-titles.interface.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export class CollectionMemberTitles implements MemberTitles {
    constructor(
        private readonly books: BookRepository,
        private readonly clock: Clock,
    ) {}

    async regenerate(
        collectionName: string,
        members: readonly TitledMember[],
    ): Promise<RelatedChange[]> {
        const now = this.clock.now().toISOString();
        const changes: RelatedChange[] = [];

        for (const member of members) {
            changes.push(
                ...(await this.change(member.bookId, (book) =>
                    book.regenerateTitle({ name: collectionName, ...member }, now),
                )),
            );
        }

        return changes;
    }

    async keep(bookIds: readonly string[]): Promise<RelatedChange[]> {
        const now = this.clock.now().toISOString();
        const changes: RelatedChange[] = [];

        for (const bookId of bookIds) {
            changes.push(...(await this.change(bookId, (book) => book.keepTitle(now))));
        }

        return changes;
    }

    private async change(bookId: string, apply: (book: Book) => boolean): Promise<RelatedChange[]> {
        const book = await this.books.findById(bookId);

        if (!book) {
            return [];
        }

        const before = CollectionMemberTitles.title(book);

        if (!apply(book)) {
            return [];
        }

        await this.books.save(book);

        return [
            {
                category: BookAudit.retitled,
                subjectType: BookAudit.book,
                subjectId: bookId,
                before,
                after: CollectionMemberTitles.title(book),
            },
        ];
    }

    private static title(book: Book): Record<string, unknown> {
        const { title, titleGenerated } = book.details;

        return { title, titleGenerated };
    }
}
