export class ActivityEligibility {
    static readonly categories: readonly string[] = [
        'book.created',
        'book.updated',
        'book.marked-owned',
        'book.deleted',
        'book.organised',
        'book.cover-changed',
        'book.retitled',
        'book.category-changed',
        'author.corrected',
        'collection.created',
        'collection.updated',
        'collection.finished',
        'collection.reopened',
        'collection.deleted',
        'collection.removed',
        'collection.volumes-added',
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
