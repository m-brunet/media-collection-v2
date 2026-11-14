import type { CreateBookUseCase } from '../ports/driving/create-book-use-case.interface.js';
import type { BookInput } from '../book-input.js';
import type { BookView } from '../book-views.js';
import { BookAudit } from '../book-audit.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { BookCreation } from '../services/book-creation.service.js';
import type { BookViewer } from '../services/book-viewer.service.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class CreateBook implements CreateBookUseCase {
    constructor(
        private readonly creation: BookCreation,
        private readonly covers: CoverStorage,
        private readonly viewer: BookViewer,
        private readonly ids: IdGenerator,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, input: BookInput, read: boolean): Promise<BookView> {
        const { view, replacedCovers } = await this.operations.run(
            {
                category: BookAudit.created,
                actorId: actor.id,
                subjectType: BookAudit.book,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireLibraryEditor(actor);
                const id = this.ids.next();

                context.subjectId = id;
                const created = await this.creation.create(actor, id, input, read);

                return {
                    result: {
                        view: await this.viewer.view(created.book, actor),
                        replacedCovers: created.replaced.flatMap(
                            (planned) => planned.book.snapshot.coverFile ?? [],
                        ),
                    },
                    before: null,
                    after: created.after,
                    related: created.related,
                };
            },
        );

        for (const file of replacedCovers) {
            await this.covers.remove(file);
        }

        return view;
    }
}
