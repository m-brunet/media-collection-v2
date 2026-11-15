import { useState } from 'react';
import type { BookcaseDto, BookListItemDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useAction } from '../../shared/use-action';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { LocationField } from '../books/location-field';

export interface MovedBook {
    book: BookListItemDto;
    message: string;
}

function MoveForm({
    book,
    bookcases,
    from,
    onMoved,
    onClose,
}: {
    book: BookListItemDto;
    bookcases: BookcaseDto[];
    from: { bookcaseId: string; shelfId: string };
    onMoved(moved: MovedBook): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const [place, setPlace] = useState<{ bookcaseId: string | null; shelfId: string | null }>(from);
    const action = useAction();
    const bookcase = bookcases.find((candidate) => candidate.id === place.bookcaseId);
    const shelf = bookcase?.shelves.find((candidate) => candidate.id === place.shelfId);
    const ready = shelf !== undefined && shelf.id !== from.shelfId;

    return (
        <form
            className="form"
            onSubmit={(event) => {
                event.preventDefault();

                if (!bookcase || !shelf) {
                    return;
                }

                void action.run(async () => {
                    await api.request('/books/' + book.id + '/organisation', {
                        method: 'PATCH',
                        body: { shelfId: shelf.id },
                    });
                    onMoved({
                        book,
                        message: t('columns.moved', {
                            title: book.title,
                            bookcase: bookcase.name,
                            shelf: shelf.name,
                        }),
                    });
                });
            }}
        >
            <p>{t('columns.moveBody')}</p>
            <LocationField bookcases={bookcases} shelfId={place.shelfId} onChange={setPlace} />
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" variant="primary" busy={action.busy} disabled={!ready}>
                    {t('columns.moveSubmit')}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
            </div>
        </form>
    );
}

export function MoveBookDialog({
    book,
    bookcases,
    from,
    onMoved,
    onClose,
}: {
    book: BookListItemDto | null;
    bookcases: BookcaseDto[];
    from: { bookcaseId: string; shelfId: string };
    onMoved(moved: MovedBook): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog
            open={book !== null}
            title={book ? t('columns.moveTitle', { title: book.title }) : ''}
            onClose={onClose}
        >
            {book && (
                <MoveForm
                    key={book.id}
                    book={book}
                    bookcases={bookcases}
                    from={from}
                    onMoved={onMoved}
                    onClose={onClose}
                />
            )}
        </Dialog>
    );
}
