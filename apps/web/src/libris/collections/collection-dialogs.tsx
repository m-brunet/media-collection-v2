import { useState } from 'react';
import type {
    BookCategory,
    CollectionChangesDto,
    CollectionDetailsDto,
} from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { SelectField } from '../../shared/ui/select-field';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

export function EditCollectionDialog({
    collection,
    open,
    onSaved,
    onDeleted,
    onClose,
}: {
    collection: CollectionDetailsDto;
    open: boolean;
    onSaved(collection: CollectionDetailsDto): void;
    onDeleted(): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    return (
        <>
            <Dialog
                open={open && !confirmingDelete}
                title={t('editCollection.title')}
                onClose={onClose}
            >
                {open && (
                    <EditCollectionForm
                        key={
                            collection.id +
                            collection.name +
                            collection.includesVolumeZero +
                            collection.category
                        }
                        collection={collection}
                        onSaved={onSaved}
                        onDelete={() => setConfirmingDelete(true)}
                        onClose={onClose}
                    />
                )}
            </Dialog>
            <DeleteCollectionDialog
                collection={collection}
                open={open && confirmingDelete}
                onDeleted={onDeleted}
                onClose={() => setConfirmingDelete(false)}
            />
        </>
    );
}

function EditCollectionForm({
    collection,
    onSaved,
    onDelete,
    onClose,
}: {
    collection: CollectionDetailsDto;
    onSaved(collection: CollectionDetailsDto): void;
    onDelete(): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const [name, setName] = useState(collection.name);
    const [volumeZero, setVolumeZero] = useState(collection.includesVolumeZero);
    const [category, setCategory] = useState<BookCategory>(collection.category);
    const action = useAction();
    const recategorised = category !== collection.category;
    const changes: CollectionChangesDto = {
        name,
        includesVolumeZero: volumeZero,
        ...(recategorised ? { category } : {}),
    };

    return (
        <form
            className="form"
            onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () =>
                    onSaved(
                        await api.request<CollectionDetailsDto>('/collections/' + collection.id, {
                            method: 'PATCH',
                            body: changes,
                        }),
                    ),
                );
            }}
        >
            <p>{t('editCollection.body')}</p>
            <TextField
                label={t('editCollection.name')}
                value={name}
                required
                maxLength={200}
                autoFocus
                onChange={(event) => setName(event.target.value)}
            />
            <SelectField
                label={t('form.category')}
                value={category}
                hint={
                    recategorised
                        ? t(
                              collection.bookCount === 1
                                  ? 'editCollection.categoryChangeOne'
                                  : 'editCollection.categoryChange',
                              {
                                  count: collection.bookCount,
                                  category: t(BookFormat.category(category)),
                              },
                          )
                        : t('editCollection.categoryHint')
                }
                options={BookFormat.categories.map((choice) => ({
                    value: choice,
                    label: t(BookFormat.category(choice)),
                }))}
                onChange={(event) =>
                    setCategory(
                        BookFormat.categories.find((choice) => choice === event.target.value) ??
                            collection.category,
                    )
                }
            />
            <fieldset className="form">
                <legend className="field__label">{t('editCollection.range')}</legend>
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={volumeZero}
                        onChange={(event) => setVolumeZero(event.target.checked)}
                    />
                    {t('editCollection.volumeZero')}
                </label>
            </fieldset>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" variant="primary" busy={action.busy}>
                    {t('editCollection.save')}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button variant="danger" icon="delete" className="actions__end" onClick={onDelete}>
                    {t('editCollection.delete')}
                </Button>
            </div>
        </form>
    );
}

function DeleteCollectionDialog({
    collection,
    open,
    onDeleted,
    onClose,
}: {
    collection: CollectionDetailsDto;
    open: boolean;
    onDeleted(): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const action = useAction();

    return (
        <Dialog
            open={open}
            title={t('deleteCollection.title')}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="danger"
                        busy={action.busy}
                        onClick={() =>
                            void action.run(async () => {
                                await api.request('/collections/' + collection.id, {
                                    method: 'DELETE',
                                });
                                onDeleted();
                            })
                        }
                    >
                        {t('deleteCollection.confirm')}
                    </Button>
                </>
            }
        >
            <p>{t('deleteCollection.body', { name: collection.name })}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
        </Dialog>
    );
}
