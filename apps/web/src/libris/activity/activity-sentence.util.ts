import type { ActivityEventDto } from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';
import { Required } from '../../shared/required.util';
import { BookFormat } from '../../shared/book-form/book-format.util';

type Translate = (key: MessageKey, values?: MessageValues) => string;
type Kind = ActivityEventDto['kind'];

export class ActivitySentence {
    private static readonly sentences: Record<Kind, MessageKey> = {
        'book-added': 'activity.bookAdded',
        'book-updated': 'activity.bookUpdated',
        'book-marked-owned': 'activity.bookMarkedOwned',
        'book-deleted': 'activity.bookDeleted',
        'book-relocated': 'activity.bookRelocated',
        'book-retagged': 'activity.bookRetagged',
        'book-organised': 'activity.bookOrganised',
        'book-cover-changed': 'activity.bookCoverChanged',
        'books-lent': 'activity.booksLent',
        'books-returned': 'activity.booksReturned',
        'author-corrected': 'activity.authorCorrected',
        'collection-created': 'activity.collectionCreated',
        'collection-updated': 'activity.collectionUpdated',
        'collection-renamed': 'activity.collectionRenamed',
        'collection-category-changed': 'activity.collectionCategoryChanged',
        'volumes-added': 'activity.volumesAdded',
        'collection-finished': 'activity.collectionFinished',
        'collection-reopened': 'activity.collectionReopened',
        'collection-deleted': 'activity.collectionDeleted',
        'collection-removed': 'activity.collectionRemoved',
        'bookcase-created': 'activity.bookcaseCreated',
        'bookcase-renamed': 'activity.bookcaseRenamed',
        'bookcase-deleted': 'activity.bookcaseDeleted',
        'shelf-created': 'activity.shelfCreated',
        'shelf-renamed': 'activity.shelfRenamed',
        'shelf-moved': 'activity.shelfMoved',
        'shelf-deleted': 'activity.shelfDeleted',
        'tag-created': 'activity.tagCreated',
        'tag-renamed': 'activity.tagRenamed',
        'tag-deleted': 'activity.tagDeleted',
        'receiver-created': 'activity.receiverCreated',
    };

    private static readonly consequences: Partial<Record<Kind, MessageKey>> = {
        'collection-created': 'activity.also.collectionCreated',
        'collection-updated': 'activity.also.collectionUpdated',
        'collection-reopened': 'activity.also.collectionReopened',
        'collection-removed': 'activity.also.collectionRemoved',
        'tag-created': 'activity.also.tagCreated',
        'receiver-created': 'activity.also.receiverCreated',
    };

    static main(event: ActivityEventDto, t: Translate): string {
        if (event.kind === 'books-lent' || event.kind === 'books-returned') {
            const one = event.titles.length === 1;
            const key =
                event.kind === 'books-lent'
                    ? one
                        ? 'activity.bookLent'
                        : 'activity.booksLent'
                    : one
                      ? 'activity.bookReturned'
                      : 'activity.booksReturned';

            return t(key, {
                title: Required.at(event.titles, 0, 'an event names at least one book'),
                count: event.titles.length,
                receiver: event.receiver,
            });
        }

        if (event.kind === 'volumes-added') {
            return t(event.count === 1 ? 'activity.volumeAdded' : 'activity.volumesAdded', {
                name: event.name,
                count: event.count,
            });
        }

        if (event.kind === 'collection-category-changed') {
            const key =
                event.count === 0
                    ? 'activity.collectionCategoryChangedEmpty'
                    : event.count === 1
                      ? 'activity.collectionCategoryChangedOne'
                      : 'activity.collectionCategoryChanged';

            return t(key, {
                name: event.name,
                category: t(BookFormat.category(event.category)),
                count: event.count,
            });
        }

        return t(ActivitySentence.sentences[event.kind], ActivitySentence.values(event, t));
    }

    static also(events: readonly ActivityEventDto[], t: Translate): string | null {
        if (events.length === 0) {
            return null;
        }

        const changes = events.map((event) => {
            const key = ActivitySentence.consequences[event.kind];

            return key
                ? t(key, ActivitySentence.values(event, t))
                : ActivitySentence.main(event, t);
        });

        return t('activity.also', { changes: changes.join(' · ') });
    }

    private static values(event: ActivityEventDto, t: Translate): MessageValues {
        if ('title' in event) {
            return { title: event.title ?? t('activity.aBook') };
        }

        if ('titles' in event) {
            return { receiver: event.receiver, count: event.titles.length };
        }

        return { ...event };
    }
}
