import { useState } from 'react';
import type {
    AuthorDto,
    CoverageConflictBook,
    CoverageConflictDetails,
    PossibleDuplicateDetails,
    SimilarAuthorDetails,
    SimilarCollectionDetails,
    VolumeZeroDetails,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { CollectionFormat } from '../collections/collection-format.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { Required } from '../../shared/required.util';

export function SimilarAuthorDialog({
    similar,
    onUse,
    onCreate,
    onClose,
}: {
    similar: SimilarAuthorDetails | null;
    onUse(author: AuthorDto): void;
    onCreate(): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog open={similar !== null} title={t('similar.title')} onClose={onClose}>
            {similar && (
                <div className="stack stack--compact">
                    <p>{t('similar.body', { name: similar.name })}</p>
                    <div className="dialog__choices">
                        {similar.candidates.map((candidate) => (
                            <Button
                                key={candidate.id}
                                variant="primary"
                                onClick={() => onUse(candidate)}
                            >
                                {t('similar.use', { name: candidate.name })}
                            </Button>
                        ))}
                        <Button onClick={onCreate}>
                            {t('similar.create', { name: similar.name })}
                        </Button>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    );
}

export function PossibleDuplicateDialog({
    duplicate,
    onOpen,
    onContinue,
    onClose,
}: {
    duplicate: PossibleDuplicateDetails | null;
    onOpen(bookId: string): void;
    onContinue(): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog open={duplicate !== null} title={t('duplicate.title')} onClose={onClose}>
            {duplicate && (
                <div className="stack stack--compact">
                    <p>{t('duplicate.body')}</p>
                    <p className="field__label">{t('duplicate.match')}</p>
                    <ul className="duplicate-list">
                        {duplicate.candidates.map((candidate) => (
                            <li key={candidate.id} className="duplicate-list__item">
                                <span>
                                    {candidate.title} · {candidate.authors.join(', ')}
                                </span>
                                <Button
                                    variant="primary"
                                    aria-label={t('duplicate.open') + ' · ' + candidate.title}
                                    onClick={() => onOpen(candidate.id)}
                                >
                                    {t('duplicate.open')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                    <div className="dialog__choices">
                        <Button onClick={onContinue}>{t('duplicate.continue')}</Button>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    );
}

export function CorrectAuthorDialog({
    author,
    onCorrected,
    onClose,
}: {
    author: AuthorDto | null;
    onCorrected(author: AuthorDto): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog open={author !== null} title={t('correct.title')} onClose={onClose}>
            {author && (
                <CorrectAuthorForm
                    key={author.id}
                    author={author}
                    onCorrected={onCorrected}
                    onClose={onClose}
                />
            )}
        </Dialog>
    );
}

function CorrectAuthorForm({
    author,
    onCorrected,
    onClose,
}: {
    author: AuthorDto;
    onCorrected(author: AuthorDto): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const [name, setName] = useState(author.name);
    const action = useAction();

    return (
        <form
            className="form"
            onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () =>
                    onCorrected(
                        await api.request<AuthorDto>('/authors/' + author.id, {
                            method: 'PUT',
                            body: { name },
                        }),
                    ),
                );
            }}
        >
            <p>{t('correct.body')}</p>
            <TextField
                label={t('correct.name')}
                value={name}
                required
                maxLength={200}
                autoFocus
                onChange={(event) => setName(event.target.value)}
            />
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" variant="primary" busy={action.busy}>
                    {t('correct.confirm')}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
            </div>
        </form>
    );
}

export function DiscardChangesDialog({
    open,
    onKeep,
    onDiscard,
}: {
    open: boolean;
    onKeep(): void;
    onDiscard(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog
            open={open}
            title={t('discard.title')}
            onClose={onKeep}
            footer={
                <>
                    <Button variant="primary" onClick={onKeep}>
                        {t('discard.keep')}
                    </Button>
                    <Button variant="danger" onClick={onDiscard}>
                        {t('discard.confirm')}
                    </Button>
                </>
            }
        >
            <p>{t('discard.body')}</p>
        </Dialog>
    );
}

export function SimilarCollectionDialog({
    similar,
    onUse,
    onCreate,
    onClose,
}: {
    similar: SimilarCollectionDetails | null;
    onUse(name: string): void;
    onCreate(): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog open={similar !== null} title={t('similarCollection.title')} onClose={onClose}>
            {similar && (
                <div className="stack stack--compact">
                    <p>{t('similarCollection.body', { name: similar.name })}</p>
                    <div className="dialog__choices">
                        {similar.candidates.map((candidate) => (
                            <Button
                                key={candidate.id}
                                variant="primary"
                                onClick={() => onUse(candidate.name)}
                            >
                                {t('similarCollection.use', { name: candidate.name })}
                            </Button>
                        ))}
                        <Button onClick={onCreate}>
                            {t('similarCollection.create', { name: similar.name })}
                        </Button>
                        <Button variant="ghost" onClick={onClose}>
                            {t('common.cancel')}
                        </Button>
                    </div>
                </div>
            )}
        </Dialog>
    );
}

export function VolumeZeroDialog({
    volumeZero,
    onEnable,
    onClose,
}: {
    volumeZero: VolumeZeroDetails | null;
    onEnable(): void;
    onClose(): void;
}) {
    const { t } = useI18n();

    return (
        <Dialog
            open={volumeZero !== null}
            title={t('volumeZero.title')}
            onClose={onClose}
            footer={
                <>
                    <Button variant="primary" onClick={onEnable}>
                        {t('volumeZero.confirm')}
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                </>
            }
        >
            {volumeZero && <p>{t('volumeZero.body', { name: volumeZero.name })}</p>}
        </Dialog>
    );
}

function ConflictingBook({ book }: { book: CoverageConflictBook }) {
    const { t } = useI18n();
    const volumes = CollectionFormat.volumes(book.volumeFrom, book.volumeTo);

    return (
        <li className="duplicate-list__item">
            <span>
                {book.title} · {t(volumes.key, volumes.values)} ·{' '}
                {t(BookFormat.ownership(book.ownership))}
                {book.isbn ? ' · ISBN ' + book.isbn : ''}
            </span>
        </li>
    );
}

export function CoverageConflictDialog({
    conflict,
    purchased,
    creating,
    onUpdatePlanned,
    onReplace,
    onClose,
}: {
    conflict: CoverageConflictDetails | null;
    purchased: { title: string; isbn: string | null; volumeFrom: number; volumeTo: number };
    creating: boolean;
    onUpdatePlanned(bookId: string): void;
    onReplace(bookIds: string[]): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const purchasedVolumes = CollectionFormat.volumes(purchased.volumeFrom, purchased.volumeTo);
    const [only] = conflict?.conflicts ?? [];
    const single =
        conflict?.conflicts.length === 1 &&
        only !== undefined &&
        only.volumeFrom === purchased.volumeFrom &&
        only.volumeTo === purchased.volumeTo;
    const highest = Math.max(0, ...(conflict?.conflicts ?? []).map((book) => book.volumeTo));
    const shrinksTo = conflict?.expectedAfterReplacement?.to ?? null;
    const ids = conflict?.conflicts.map((book) => book.id) ?? [];
    const cancel = (
        <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
        </Button>
    );

    if (conflict && !conflict.replaceable) {
        return (
            <Dialog open title={t('coverage.blockedTitle')} onClose={onClose} footer={cancel}>
                <div className="stack stack--compact">
                    <p>{t('coverage.blockedBody')}</p>
                    <p className="field__label">{t('coverage.blockedList')}</p>
                    <ul className="duplicate-list">
                        {conflict.conflicts.map((book) => (
                            <ConflictingBook key={book.id} book={book} />
                        ))}
                    </ul>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open={conflict !== null}
            title={single ? t('coverage.title') : t('coverage.manyTitle')}
            onClose={onClose}
        >
            {conflict && (
                <div className="stack stack--compact">
                    <p>
                        {single
                            ? t('coverage.body')
                            : t('coverage.manyBody', {
                                  volumes: t(purchasedVolumes.key, purchasedVolumes.values),
                              })}
                    </p>
                    <p className="field__label">
                        {single ? t('coverage.affected') : t('coverage.affectedMany')}
                    </p>
                    <ul className="duplicate-list">
                        {conflict.conflicts.map((book) => (
                            <ConflictingBook key={book.id} book={book} />
                        ))}
                    </ul>
                    <p className="field__label">{t('coverage.purchased')}</p>
                    <p>
                        {purchased.title} · {t(purchasedVolumes.key, purchasedVolumes.values)}
                        {purchased.isbn ? ' · ISBN ' + purchased.isbn : ''}
                    </p>
                    {!single && shrinksTo !== null && shrinksTo < highest && (
                        <Notice tone="info">{t('coverage.shrink', { to: shrinksTo })}</Notice>
                    )}
                    {single && creating && <p className="muted">{t('coverage.updateHint')}</p>}
                    <div className="dialog__choices">
                        {single && creating && (
                            <Button
                                variant="primary"
                                onClick={() =>
                                    onUpdatePlanned(
                                        Required.at(ids, 0, 'a single conflict has one book'),
                                    )
                                }
                            >
                                {t('coverage.update')}
                            </Button>
                        )}
                        <Button
                            variant={single && creating ? 'secondary' : 'primary'}
                            onClick={() => onReplace(ids)}
                        >
                            {single ? t('coverage.delete') : t('coverage.deleteMany')}
                        </Button>
                        {cancel}
                    </div>
                </div>
            )}
        </Dialog>
    );
}
