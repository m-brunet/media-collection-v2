import type { BookTagStore } from '../ports/driven/book-tag-store.interface.js';
import type { TagRepository } from '../ports/driven/tag-repository.interface.js';
import { BookTagAssignment } from '../services/book-tag-assignment.service.js';
import { TagLoader } from '../services/tag-loader.service.js';
import { TagNaming } from '../services/tag-naming.service.js';
import { TagViewer } from '../services/tag-viewer.service.js';
import { Tag } from '../../domain/entities/tag.entity.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';

export class MemoryBookTags implements BookTagStore {
    readonly links = new Map<string, string[]>();

    async tagsOf(bookId: string): Promise<string[]> {
        return [...(this.links.get(bookId) ?? [])];
    }

    async replace(bookId: string, tagIds: readonly string[]): Promise<void> {
        this.links.set(bookId, [...tagIds]);
    }

    async countByTag(): Promise<Map<string, number>> {
        const counts = new Map<string, number>();

        for (const tagIds of this.links.values()) {
            for (const tagId of tagIds) {
                counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
            }
        }

        return counts;
    }
}

export class MemoryTags implements TagRepository {
    readonly tags = new Map<string, Tag>();

    constructor(private readonly store: MemoryBookTags) {}

    async findById(id: string): Promise<Tag | null> {
        const tag = this.tags.get(id);

        return tag ? new Tag(tag.snapshot) : null;
    }

    async findByKey(key: string): Promise<Tag | null> {
        const tag = [...this.tags.values()].find((value) => value.key === key);

        return tag ? new Tag(tag.snapshot) : null;
    }

    async list(): Promise<Tag[]> {
        return [...this.tags.values()]
            .sort((first, second) => first.key.localeCompare(second.key))
            .map((tag) => new Tag(tag.snapshot));
    }

    async create(tag: Tag): Promise<void> {
        if (await this.findByKey(tag.key)) {
            throw new Failure('conflict', 'Equivalent tag', 'tag-name-taken');
        }

        this.tags.set(tag.id, new Tag(tag.snapshot));
    }

    async save(tag: Tag): Promise<void> {
        this.tags.set(tag.id, new Tag(tag.snapshot));
    }

    async delete(id: string): Promise<void> {
        this.tags.delete(id);

        for (const [bookId, tagIds] of this.store.links) {
            this.store.links.set(
                bookId,
                tagIds.filter((tagId) => tagId !== id),
            );
        }
    }
}

export class TagDoubles {
    // Tags with all doubles and services wired as in production.
    static labels() {
        const store = new MemoryBookTags();
        const tags = new MemoryTags(store);
        const trail = new MemoryAuditTrail();
        const loader = new TagLoader(tags);
        let counter = 0;
        const ids = { next: () => 'tag-' + ++counter };
        const clock = { now: () => new Date('2026-03-01T10:00:00Z') };

        return {
            tags,
            store,
            trail,
            loader,
            ids,
            clock,
            naming: new TagNaming(tags),
            viewer: new TagViewer(),
            operations: AuditDoubles.auditedOperation(trail),
            assignment: new BookTagAssignment(tags, store, loader, ids, clock),
        };
    }

    // Saves a tag, for arranging scenarios.
    static async tagged(current: ReturnType<typeof TagDoubles.labels>, name: string): Promise<Tag> {
        const tag = new Tag({
            id: current.ids.next(),
            name,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        });

        await current.tags.create(tag);

        return tag;
    }

    // Links tags to a book, for arranging scenarios.
    static async labelled(
        current: ReturnType<typeof TagDoubles.labels>,
        bookId: string,
        ...tags: Tag[]
    ) {
        await current.store.replace(
            bookId,
            tags.map((tag) => tag.id),
        );
    }
}

export const owner = TestActors.of('owner', 'camille');
export const guest = TestActors.of('guest', 'morgan');
