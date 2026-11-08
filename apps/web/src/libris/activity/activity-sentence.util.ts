import type { ActivityEventDto } from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import type { MessageValues } from '../../shared/i18n/translator.util';

type Translate = (key: MessageKey, values?: MessageValues) => string;
type Kind = ActivityEventDto['kind'];

// Writes what an Activity entry says, always with the household "You", whoever acted.
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

    // The changes an operation caused, said without "You" after "Also:".
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
                title: event.titles[0]!,
                count: event.titles.length,
                receiver: event.receiver,
            });
        }

        return t(ActivitySentence.sentences[event.kind], ActivitySentence.values(event, t));
    }

    // "Also: created the collection Naruto · created the tag Fantasy", or null when nothing else
    // changed.
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
