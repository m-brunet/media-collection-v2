import { useState } from 'react';
import type {
    AuthorDto,
    PossibleDuplicateDetails,
    SimilarAuthorDetails,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

// A typed author name is close to existing authors: reuse one, or confirm a different person.
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

// A new book without ISBN looks like a saved one: open it, or continue with a distinct edition.
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

// Corrects the shared spelling of an author, everywhere it is linked, after confirmation.
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

// Leaving a form with unsaved changes asks first.
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
