import type { OrganisationRequest } from '../book-input.js';
import type { BookOrganisation } from '../book-views.js';
import type { ShelfAssignment } from '../ports/driven/shelf-assignment.interface.js';
import type { TagAssignment } from '../ports/driven/tag-assignment.interface.js';
import { BookOrganisationReader } from './book-organisation-reader.service.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';

// Location and tags of books, applied through the locations and tags features. A part the
// request leaves out keeps its current value.
export class BookOrganiser {
    constructor(
        private readonly shelves: ShelfAssignment,
        private readonly tags: TagAssignment,
        private readonly reader: BookOrganisationReader,
    ) {}

    async current(bookId: string): Promise<BookOrganisation> {
        return this.reader.current(bookId);
    }

    async apply(
        bookId: string,
        request: OrganisationRequest,
    ): Promise<{ organisation: BookOrganisation; changes: RelatedChange[] }> {
        const current =
            request.shelfId === undefined || request.tags === undefined
                ? await this.reader.current(bookId)
                : null;
        const location =
            request.shelfId === undefined
                ? current!.location
                : await this.shelves.assign(bookId, request.shelfId);
        const outcome =
            request.tags === undefined
                ? { tags: current!.tags, changes: [] }
                : await this.tags.assign(bookId, request.tags);

        return { organisation: { location, tags: outcome.tags }, changes: outcome.changes };
    }
}
