import { TagSnapshot } from '../tag-audit.js';
import type { BookTagStore } from '../ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { TagLoader } from './tag-loader.service.js';
import { Tag } from '../../domain/entities/tag.entity.js';
import type {
    BookTag,
    BookTagReader,
} from '../../../books/application/ports/driven/book-tag-reader.interface.js';
import type {
    TagAssignment,
    TagChoice,
    TagOutcome,
} from '../../../books/application/ports/driven/tag-assignment.interface.js';
import type { RelatedChange } from '../../../shared/application/ports/driven/audit-entry.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export class BookTagAssignment implements TagAssignment, BookTagReader {
    constructor(
        private readonly tags: TagRepository,
        private readonly store: BookTagStore,
        private readonly loader: TagLoader,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async assign(bookId: string, choices: readonly TagChoice[]): Promise<TagOutcome> {
        const chosen = new Map<string, Tag>();
        const changes: RelatedChange[] = [];

        for (const choice of choices) {
            const { tag, created } = await this.resolve(choice);

            chosen.set(tag.id, tag);

            if (created) {
                changes.push(TagSnapshot.created(tag));
            }
        }

        await this.store.replace(bookId, [...chosen.keys()]);

        return { tags: this.ordered([...chosen.values()]), changes };
    }

    async of(bookId: string): Promise<BookTag[]> {
        const tags = [];

        for (const tagId of await this.store.tagsOf(bookId)) {
            tags.push(await this.loader.load(tagId));
        }

        return this.ordered(tags);
    }

    private async resolve(choice: TagChoice): Promise<{ tag: Tag; created: boolean }> {
        if ('id' in choice) {
            return { tag: await this.loader.load(choice.id), created: false };
        }

        const name = Tag.validName(choice.name);
        const equivalent = await this.tags.findByKey(NameKey.of(name));

        if (equivalent) {
            return { tag: equivalent, created: false };
        }

        const now = this.clock.now().toISOString();
        const tag = new Tag({ id: this.ids.next(), name, createdAt: now, updatedAt: now });

        await this.tags.create(tag);

        return { tag, created: true };
    }

    private ordered(tags: Tag[]): BookTag[] {
        return tags
            .sort((first, second) => first.key.localeCompare(second.key))
            .map((tag) => ({ id: tag.id, name: tag.snapshot.name }));
    }
}
