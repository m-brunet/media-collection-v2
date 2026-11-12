export class CollectionReading {
    private constructor(
        private readonly owned: readonly string[],
        private readonly readIds: ReadonlySet<string>,
    ) {
        Object.freeze(this);
    }

    static of(
        ownedBookIds: readonly string[],
        readBookIds: ReadonlySet<string>,
    ): CollectionReading {
        const owned = [...new Set(ownedBookIds)];

        return new CollectionReading(
            owned,
            new Set(owned.filter((bookId) => readBookIds.has(bookId))),
        );
    }

    get ownedCount(): number {
        return this.owned.length;
    }

    get read(): boolean {
        return this.owned.length > 0 && this.readIds.size === this.owned.length;
    }

    booksToMark(read: boolean): string[] {
        return this.owned.filter((bookId) => this.readIds.has(bookId) !== read);
    }

    marked(read: boolean): CollectionReading {
        return new CollectionReading(this.owned, new Set(read ? this.owned : []));
    }

    get view(): { read: boolean; ownedCount: number } {
        return { read: this.read, ownedCount: this.ownedCount };
    }
}
