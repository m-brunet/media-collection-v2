import { BookAudit } from '../book-audit.js';
import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { Book, BookCategory } from '../../domain/entities/book.entity.js';
import type { MemberCategories } from '../../../collections/application/ports/driven/member-categories.interface.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export class CollectionMemberCategories implements MemberCategories {
    constructor(
        private readonly books: BookRepository,
        private readonly clock: Clock,
    ) {}

    async change(category: BookCategory, bookIds: readonly string[]): Promise<RelatedChange[]> {
        const now = this.clock.now().toISOString();
        const changes: RelatedChange[] = [];

        for (const bookId of bookIds) {
            const book = await this.books.findById(bookId);

            if (!book) {
                continue;
            }

            const before = CollectionMemberCategories.category(book);

            if (!book.changeCategory(category, now)) {
                continue;
            }

            await this.books.save(book);
            changes.push({
                category: BookAudit.categoryChanged,
                subjectType: BookAudit.book,
                subjectId: bookId,
                before,
                after: CollectionMemberCategories.category(book),
            });
        }

        return changes;
    }

    private static category(book: Book): Record<string, unknown> {
        const { title, category, titleGenerated } = book.details;

        return { title, category, titleGenerated };
    }
}
