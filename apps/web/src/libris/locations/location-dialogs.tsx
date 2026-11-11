import { useState } from 'react';
import type { BookcaseDto, ShelfDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { NameDialog } from '../../shared/ui/name-dialog';
import { SelectField } from '../../shared/ui/select-field';

export type LocationEditing =
    | { kind: 'create-bookcase' }
    | { kind: 'rename-bookcase'; bookcase: BookcaseDto }
    | { kind: 'delete-bookcase'; bookcase: BookcaseDto }
    | { kind: 'create-shelf'; bookcase: BookcaseDto }
    | { kind: 'move-shelf'; shelf: ShelfDto }
    | { kind: 'rename-shelf'; shelf: ShelfDto }
    | { kind: 'delete-shelf'; shelf: ShelfDto };

function ShelfDialog({
    bookcases,
    editing,
    onDone,
    onClose,
}: {
    bookcases: BookcaseDto[];
    editing: Extract<LocationEditing, { kind: 'create-shelf' | 'move-shelf' }>;
    onDone(message: string, shelf: ShelfDto): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const moving = editing.kind === 'move-shelf' ? editing.shelf : null;
    const [bookcaseId, setBookcaseId] = useState(
        moving ? moving.bookcaseId : editing.kind === 'create-shelf' ? editing.bookcase.id : '',
    );
    const destination = bookcases.find((bookcase) => bookcase.id === bookcaseId);

    return (
        <NameDialog
            open
            title={moving ? t('shelf.moveTitle', { name: moving.name }) : t('shelf.createTitle')}
            body={moving ? t('shelf.moveBody') : t('shelf.createBody')}
            label={t('shelf.name')}
            placeholder={t('shelf.namePlaceholder')}
            initial={moving?.name ?? ''}
            submit={moving ? t('shelf.move') : t('shelf.create')}
            onSubmit={async (name) => {
                const shelf = moving
                    ? await api.request<ShelfDto>('/shelves/' + moving.id, {
                          method: 'PATCH',
                          body: { name, bookcaseId },
                      })
                    : await api.request<ShelfDto>('/bookcases/' + bookcaseId + '/shelves', {
                          method: 'POST',
                          body: { name },
                      });

                onDone(
                    moving
                        ? t('shelf.moved', { name: shelf.name, bookcase: destination?.name ?? '' })
                        : t('shelf.created', { name: shelf.name }),
                    shelf,
                );
            }}
            onClose={onClose}
        >
            <SelectField
                label={t('location.bookcase')}
                required
                value={bookcaseId}
                options={bookcases.map((bookcase) => ({
                    value: bookcase.id,
                    label: bookcase.name,
                }))}
                onChange={(event) => setBookcaseId(event.target.value)}
            />
        </NameDialog>
    );
}

export function LocationDialogs({
    bookcases,
    editing,
    onDone,
    onClose,
}: {
    bookcases: BookcaseDto[];
    editing: LocationEditing | null;
    onDone(message: string, selected?: { shelf?: string; bookcase?: string }): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    if (!editing) {
        return null;
    }

    switch (editing.kind) {
        case 'create-bookcase':
            return (
                <NameDialog
                    open
                    title={t('bookcase.createTitle')}
                    body={t('bookcase.createBody')}
                    label={t('bookcase.name')}
                    placeholder={t('bookcase.namePlaceholder')}
                    submit={t('bookcase.createFirst')}
                    onSubmit={async (name) => {
                        const bookcase = await api.request<BookcaseDto>('/bookcases', {
                            method: 'POST',
                            body: { name },
                        });

                        onDone(t('bookcase.created', { name: bookcase.name }), {
                            bookcase: bookcase.id,
                        });
                    }}
                    onClose={onClose}
                />
            );
        case 'rename-bookcase':
            return (
                <NameDialog
                    open
                    title={t('bookcase.renameTitle')}
                    body={t('bookcase.renameBody')}
                    label={t('bookcase.name')}
                    initial={editing.bookcase.name}
                    submit={t('common.saveName')}
                    onSubmit={async (name) => {
                        const bookcase = await api.request<BookcaseDto>(
                            '/bookcases/' + editing.bookcase.id,
                            { method: 'PATCH', body: { name } },
                        );

                        onDone(t('bookcase.renamed', { name: bookcase.name }));
                    }}
                    onClose={onClose}
                />
            );
        case 'delete-bookcase':
            return (
                <ConfirmDialog
                    open
                    title={t('bookcase.deleteTitle', { name: editing.bookcase.name })}
                    body={
                        (editing.bookcase.bookCount === 1
                            ? t('location.unassignedOne')
                            : t('location.unassignedMany', {
                                  count: editing.bookcase.bookCount,
                              })) +
                        ' ' +
                        (editing.bookcase.shelves.length === 0
                            ? t('bookcase.deleteBodyNone')
                            : editing.bookcase.shelves.length === 1
                              ? t('bookcase.deleteBodyOne')
                              : t('bookcase.deleteBodyMany', {
                                    count: editing.bookcase.shelves.length,
                                }))
                    }
                    confirm={t('bookcase.delete')}
                    onConfirm={async () => {
                        await api.request('/bookcases/' + editing.bookcase.id, {
                            method: 'DELETE',
                        });
                        onDone(t('bookcase.deleted', { name: editing.bookcase.name }), {});
                    }}
                    onClose={onClose}
                />
            );
        case 'create-shelf':
        case 'move-shelf':
            return (
                <ShelfDialog
                    bookcases={bookcases}
                    editing={editing}
                    onDone={(message, shelf) => onDone(message, { shelf: shelf.id })}
                    onClose={onClose}
                />
            );
        case 'rename-shelf':
            return (
                <NameDialog
                    open
                    title={t('shelf.renameTitle')}
                    body={t('shelf.renameBody')}
                    label={t('shelf.name')}
                    initial={editing.shelf.name}
                    submit={t('common.saveName')}
                    onSubmit={async (name) => {
                        const shelf = await api.request<ShelfDto>('/shelves/' + editing.shelf.id, {
                            method: 'PATCH',
                            body: { name },
                        });

                        onDone(t('shelf.renamed', { name: shelf.name }));
                    }}
                    onClose={onClose}
                />
            );
        case 'delete-shelf':
            return (
                <ConfirmDialog
                    open
                    title={t('shelf.deleteTitle', { name: editing.shelf.name })}
                    body={
                        (editing.shelf.bookCount === 1
                            ? t('location.unassignedOne')
                            : t('location.unassignedMany', { count: editing.shelf.bookCount })) +
                        ' ' +
                        t('shelf.deleteBody')
                    }
                    confirm={t('shelf.delete')}
                    onConfirm={async () => {
                        await api.request('/shelves/' + editing.shelf.id, { method: 'DELETE' });
                        onDone(t('shelf.deleted', { name: editing.shelf.name }), {
                            bookcase: editing.shelf.bookcaseId,
                        });
                    }}
                    onClose={onClose}
                />
            );
    }
}
