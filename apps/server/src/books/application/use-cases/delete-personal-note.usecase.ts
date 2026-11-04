import type { DeletePersonalNoteUseCase } from '../ports/driving/delete-personal-note-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { PersonalNoteStore } from '../ports/driven/personal-note-store.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Removes only the author's own note; the book is unchanged.
export class DeletePersonalNote implements DeletePersonalNoteUseCase {
    constructor(
        private readonly notes: PersonalNoteStore,
        private readonly loader: BookLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, bookId: string): Promise<void> {
        await this.operations.run(
            {
                category: BookAudit.noteChanged,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                await this.loader.load(bookId);
                const existed = (await this.notes.find(actor.id, bookId)) !== null;

                await this.notes.delete(actor.id, bookId);

                return {
                    result: undefined,
                    before: { hasNote: existed },
                    after: { hasNote: false },
                };
            },
        );
    }
}
