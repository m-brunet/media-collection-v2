import { useCallback, useEffect, useState } from 'react';
import type { TagDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { PageHeader } from '../../shared/ui/layout';
import { NameDialog } from '../../shared/ui/name-dialog';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';
import { TextField } from '../../shared/ui/text-field';
import { BookDraft } from '../books/book-draft.util';

type Editing =
    | { kind: 'create' }
    | { kind: 'rename'; tag: TagDto }
    | { kind: 'delete'; tag: TagDto };

// Reusable tags with the number of books carrying each. Owners/Admin create, rename and delete
// them; deleting a tag never deletes books, and unused tags stay available.
export function TagsPage() {
    const { t } = useI18n();
    const { account } = useSession();
    const editor = account?.role !== 'guest';
    const [tags, setTags] = useState<TagDto[] | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Editing | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const load = useCallback(
        () =>
            api.request<TagDto[]>('/tags').then(
                (found) => {
                    setTags(found);
                    setFailure(null);
                },
                (error: unknown) => setFailure(t(ApiErrorMessage.key(error))),
            ),
        [t],
    );

    useEffect(() => {
        void load();
    }, [load]);

    const key = BookDraft.nameKey(search);
    const shown = (tags ?? []).filter((tag) => BookDraft.nameKey(tag.name).includes(key));
    const close = () => setEditing(null);
    const changed = async (message: string) => {
        setEditing(null);
        setDone(message);
        await load();
    };

    return (
        <>
            <PageHeader
                title={t('tags.title')}
                intro={t('tags.intro')}
                actions={
                    editor && (
                        <Button
                            variant="primary"
                            icon="add"
                            onClick={() => setEditing({ kind: 'create' })}
                        >
                            {t('tags.create')}
                        </Button>
                    )
                }
            />
            <div className="stack">
                {done && <Notice tone="success">{done}</Notice>}
                {failure && <Notice tone="error">{failure}</Notice>}
                {!tags && !failure && <LoadingState label={t('tags.loading')} />}
                {tags && tags.length === 0 && (
                    <EmptyState
                        icon="tag"
                        title={editor ? t('tags.empty') : t('tags.emptyGuest')}
                        action={
                            editor && (
                                <Button
                                    variant="primary"
                                    onClick={() => setEditing({ kind: 'create' })}
                                >
                                    {t('tags.create')}
                                </Button>
                            )
                        }
                    />
                )}
                {tags && tags.length > 0 && (
                    <>
                        <TextField
                            label={t('tags.find')}
                            type="search"
                            placeholder={t('tags.searchPlaceholder')}
                            className="tags-page__search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {shown.length === 0 ? (
                            <p className="muted">{t('tags.noResults', { search })}</p>
                        ) : (
                            <ul className="tag-list" aria-label={t('tags.title')}>
                                {shown.map((tag) => (
                                    <li key={tag.id} className="tag-row">
                                        <span className="tag-row__name">{tag.name}</span>
                                        <span className="muted">
                                            {tag.bookCount === 1
                                                ? t('tags.booksOne')
                                                : t('tags.booksMany', { count: tag.bookCount })}
                                        </span>
                                        {editor && (
                                            <span className="tag-row__actions">
                                                <Button
                                                    aria-label={t('tags.renameNamed', {
                                                        name: tag.name,
                                                    })}
                                                    onClick={() =>
                                                        setEditing({ kind: 'rename', tag })
                                                    }
                                                >
                                                    {t('tags.rename')}
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    aria-label={t('tags.deleteNamed', {
                                                        name: tag.name,
                                                    })}
                                                    onClick={() =>
                                                        setEditing({ kind: 'delete', tag })
                                                    }
                                                >
                                                    {t('tags.delete')}
                                                </Button>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="muted">{t('tags.footnote')}</p>
                    </>
                )}
            </div>
            <NameDialog
                open={editing?.kind === 'create'}
                title={t('tags.create')}
                label={t('tags.name')}
                placeholder={t('tags.namePlaceholder')}
                submit={t('tags.create')}
                onSubmit={async (name) => {
                    const tag = await api.request<TagDto>('/tags', {
                        method: 'POST',
                        body: { name },
                    });

                    await changed(t('tags.created', { name: tag.name }));
                }}
                onClose={close}
            />
            {editing?.kind === 'rename' && (
                <NameDialog
                    open
                    title={t('tags.renameTitle')}
                    body={t('tags.renameBody')}
                    label={t('tags.name')}
                    initial={editing.tag.name}
                    submit={t('tags.renameSave')}
                    onSubmit={async (name) => {
                        const tag = await api.request<TagDto>('/tags/' + editing.tag.id, {
                            method: 'PATCH',
                            body: { name },
                        });

                        await changed(t('tags.renamed', { name: tag.name }));
                    }}
                    onClose={close}
                />
            )}
            {editing?.kind === 'delete' && (
                <ConfirmDialog
                    open
                    title={t('tags.deleteTitle', { name: editing.tag.name })}
                    body={
                        editing.tag.bookCount === 1
                            ? t('tags.deleteBodyOne')
                            : t('tags.deleteBodyMany', { count: editing.tag.bookCount })
                    }
                    confirm={t('tags.deleteConfirm')}
                    onConfirm={async () => {
                        await api.request('/tags/' + editing.tag.id, { method: 'DELETE' });
                        await changed(t('tags.deleted', { name: editing.tag.name }));
                    }}
                    onClose={close}
                />
            )}
        </>
    );
}
