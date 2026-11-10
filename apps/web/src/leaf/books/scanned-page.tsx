import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import type { BookDto, BookLookupDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useSourceNames } from '../../shared/book-form/use-source-names';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useAction } from '../../shared/use-action';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { LeafPage } from '../leaf-page';
import type { AddBookState } from './add-book-page';

type Failure =
    | { kind: 'not-found' }
    | { kind: 'unavailable'; sources: string[] }
    | { kind: 'error' };

type Step =
    | { kind: 'ready' }
    | { kind: 'finding' }
    | { kind: 'failed'; failure: Failure; attempts: number }
    | { kind: 'existing'; book: BookDto }
    | { kind: 'now-owned'; book: BookDto };

const maxAttempts = 2;

function EndActions() {
    const { t } = useI18n();
    const navigate = useNavigate();

    return (
        <>
            <Button variant="primary" icon="scan" onClick={() => navigate('/scan')}>
                {t('leaf.found.scanAnother')}
            </Button>
            <Link to="/" className="button button--secondary">
                <span>{t('leaf.scan.backHome')}</span>
            </Link>
        </>
    );
}

function BookLine({ book }: { book: BookDto }) {
    return (
        <p className="leaf-found__book">
            {book.title} · {book.authors.map((author) => author.name).join(', ')}
        </p>
    );
}

function Existing({ book, onOwned }: { book: BookDto; onOwned(book: BookDto): void }) {
    const { t } = useI18n();
    const action = useAction();

    if (book.ownership === 'owned') {
        return (
            <LeafPage title={t('leaf.found.ownedTitle')}>
                <Icon name="already-owned" size={32} className="leaf-found__icon" />
                <BookLine book={book} />
                <p className="muted">{t('leaf.found.isbn', { isbn: book.isbn ?? '' })}</p>
                <p>{t('leaf.found.ownedBody')}</p>
                <EndActions />
            </LeafPage>
        );
    }

    return (
        <LeafPage title={t('leaf.found.registeredTitle')}>
            <Icon name="existing-edition" size={32} className="leaf-found__icon" />
            <BookLine book={book} />
            <p className="muted">{t('leaf.found.savedNotOwned')}</p>
            <p>{t('leaf.found.registeredBody')}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <Button
                variant="primary"
                icon="check"
                busy={action.busy}
                onClick={() =>
                    void action.run(async () =>
                        onOwned(
                            await api.request<BookDto>('/books/' + book.id + '/owned', {
                                method: 'POST',
                            }),
                        ),
                    )
                }
            >
                {t('leaf.found.markOwned')}
            </Button>
            <EndActions />
        </LeafPage>
    );
}

function FailureMessage({ failure }: { failure: Failure }) {
    const { t } = useI18n();
    const sourceNames = useSourceNames();

    switch (failure.kind) {
        case 'not-found':
            return <>{t('leaf.found.notFound')}</>;
        case 'unavailable':
            return <>{t('leaf.found.unavailable', { sources: sourceNames(failure.sources) })}</>;
        case 'error':
            return <>{t('leaf.found.error')}</>;
    }
}

function Scanned({ isbn }: { isbn: string }) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>({ kind: 'ready' });
    const attempts = step.kind === 'failed' ? step.attempts : 0;
    const failed = (failure: Failure) =>
        setStep({ kind: 'failed', failure, attempts: attempts + 1 });
    const find = async () => {
        setStep({ kind: 'finding' });
        let result: BookLookupDto;

        try {
            result = await api.request<BookLookupDto>('/books/lookups', {
                method: 'POST',
                body: { isbn },
            });
        } catch {
            failed({ kind: 'error' });

            return;
        }

        if (result.kind === 'existing') {
            try {
                setStep({
                    kind: 'existing',
                    book: await api.request<BookDto>('/books/' + result.bookId),
                });
            } catch {
                failed({ kind: 'error' });
            }
        } else if (result.found) {
            navigate('/add', { state: { isbn, lookup: result } satisfies AddBookState });
        } else if (result.unavailable.length > 0) {
            failed({
                kind: 'unavailable',
                sources: result.unavailable.map(({ source }) => source),
            });
        } else {
            failed({ kind: 'not-found' });
        }
    };

    if (step.kind === 'existing') {
        return (
            <Existing book={step.book} onOwned={(book) => setStep({ kind: 'now-owned', book })} />
        );
    }

    if (step.kind === 'now-owned') {
        return (
            <LeafPage title={t('leaf.found.nowOwnedTitle')}>
                <Notice tone="success">
                    {t('leaf.found.nowOwnedBody', { title: step.book.title })}
                </Notice>
                <EndActions />
            </LeafPage>
        );
    }

    if (step.kind === 'failed' && step.attempts >= maxAttempts) {
        return (
            <LeafPage
                title={
                    step.failure.kind === 'not-found'
                        ? t('leaf.found.exhaustedNotFoundTitle')
                        : t('leaf.found.exhaustedTitle')
                }
            >
                <Notice tone="error">
                    <FailureMessage failure={step.failure} />
                </Notice>
                <p>{t('leaf.found.exhaustedBody')}</p>
                <Link to="/" className="button button--primary">
                    <span>{t('leaf.scan.backHome')}</span>
                </Link>
            </LeafPage>
        );
    }

    if (step.kind === 'failed') {
        return (
            <LeafPage title={t('leaf.found.failedTitle')}>
                <Notice tone="warning">
                    <FailureMessage failure={step.failure} />
                </Notice>
                <p>{t('leaf.found.retryOnce', { isbn })}</p>
                <Button variant="primary" onClick={() => void find()}>
                    {t('leaf.retry')}
                </Button>
                <Link to="/" className="button button--secondary">
                    <span>{t('leaf.scan.backHome')}</span>
                </Link>
            </LeafPage>
        );
    }

    return (
        <LeafPage
            back={{ to: '/', label: t('leaf.back.home') }}
            eyebrow={t('leaf.found.eyebrow')}
            title={t('leaf.found.title')}
        >
            <div className="leaf-found__isbn">
                <span className="field__label">{t('leaf.form.scannedIsbn')}</span>
                <span className="leaf-found__digits">{isbn}</span>
            </div>
            <p className="muted">{t('leaf.found.hint')}</p>
            {step.kind === 'finding' ? (
                <LoadingState label={t('leaf.found.finding')} />
            ) : (
                <>
                    <Button variant="primary" icon="search" onClick={() => void find()}>
                        {t('lookup.find')}
                    </Button>
                    <Button icon="scan" onClick={() => navigate('/scan')}>
                        {t('leaf.found.scanAgain')}
                    </Button>
                </>
            )}
        </LeafPage>
    );
}

export function ScannedPage() {
    const location = useLocation();
    const state = location.state as { isbn?: string } | null;

    if (!state?.isbn) {
        return <Navigate to="/" replace />;
    }

    // A new scan starts a new lookup flow, with its own retry.
    return <Scanned key={location.key} isbn={state.isbn} />;
}
