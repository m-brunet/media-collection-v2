// It is an allowlist, so a new category stays out of Activity until it is chosen here. Account,
// security, settings, personal reading status and private note events never appear.
export class ActivityEligibility {
    static readonly categories: readonly string[] = [
        'book.created',
        'book.updated',
        'book.marked-owned',
        'book.deleted',
        'book.organised',
        'book.cover-changed',
        'book.retitled',
        'author.corrected',
        'collection.created',
        'collection.updated',
        'collection.finished',
        'collection.reopened',
        'collection.deleted',
        'collection.removed',
        'bookcase.created',
        'bookcase.renamed',
        'bookcase.deleted',
        'shelf.created',
        'shelf.renamed',
        'shelf.moved',
        'shelf.deleted',
        'tag.created',
        'tag.renamed',
        'tag.deleted',
        'loan.lent',
        'loan.returned',
        'receiver.created',
    ];

    static includes(category: string): boolean {
        return ActivityEligibility.categories.includes(category);
    }
}
