import type { SavePersonalNoteUseCase } from '../ports/driving/save-personal-note-use-case.interface.js';
import { BookAudit } from '../book-audit.js';
import type { PersonalNoteStore } from '../ports/driven/personal-note-store.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class SavePersonalNote implements SavePersonalNoteUseCase {
    constructor(
        private readonly notes: PersonalNoteStore,
        private readonly loader: BookLoader,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        bookId: string,
        text: string,
    ): Promise<{ text: string; updatedAt: string }> {
        return this.operations.run(
            {
                category: BookAudit.noteChanged,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: bookId,
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const note = text.trim();

                Failure.ensure(
                    note.length >= 1 && note.length <= 5000,
                    'Write a note of up to 5000 characters.',
                    'note-invalid',
                );
                await this.loader.load(bookId);
                const existed = (await this.notes.find(actor.id, bookId)) !== null;
                const updatedAt = this.clock.now().toISOString();

                await this.notes.save(actor.id, bookId, note, updatedAt);

                return {
                    result: { text: note, updatedAt },
                    before: { hasNote: existed },
                    after: { hasNote: true },
                };
            },
        );
    }
}
