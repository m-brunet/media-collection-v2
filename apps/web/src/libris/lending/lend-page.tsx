import { useEffect, useId, useRef, useState } from 'react';
import { useBlocker, useNavigate, useSearchParams } from 'react-router';
import type {
    BookDto,
    BookListItemDto,
    BookListPageDto,
    LendingDto,
    ReceiverChoiceDto,
    ReceiverDto,
} from '../../../../../packages/contracts/src/http';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader, Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { LoadingState } from '../../shared/ui/states';
import { TextField } from '../../shared/ui/text-field';
import { BookDraft } from '../books/book-draft.util';
import { BookFormat } from '../books/book-format.util';
import { DiscardChangesDialog } from '../books/book-form-dialogs';
import type { LendingAvailability, LendingBook } from './lending-choice.util';
import { LendingChoice } from './lending-choice.util';
import { LoanLinks } from './loan-links.util';

interface SimilarReceivers {
    name: string;
    candidates: ReceiverDto[];
}

// The receiver as the person decided it: typed (reused or created by the server), an existing
// receiver chosen after a similar-name question, or a new one confirmed as someone else.
type ReceiverDecision =
    | { kind: 'typed' }
    | { kind: 'existing'; receiver: ReceiverDto }
    | { kind: 'distinct' };

const failures: Record<string, MessageKey> = {
    'book-already-lent': 'lend.failedLent',
    'book-not-owned': 'lend.failedNotOwned',
    'book-missing': 'lend.failedMissing',
};

function fromDetails(book: BookDto, locale: string): LendingBook {
    const year =
        book.publicationYear === null
            ? null
            : BookFormat.publication(book.publicationYear, book.publicationMonth, locale);

    return {
        id: book.id,
        title: book.title,
        authors: book.authors.map((author) => author.name),
        edition:
            [book.publisher, year, book.isbn ? 'ISBN ' + book.isbn : null]
                .filter(Boolean)
                .join(' · ') || null,
        ownership: book.ownership,
        loan: book.loan,
    };
}

function fromListing(book: BookListItemDto): LendingBook {
    return {
        id: book.id,
        title: book.title,
        authors: book.authors,
        edition: null,
        ownership: book.ownership,
        loan: book.loan,
    };
}

// Lends one or several books to one receiver, starting from the book the person came from. Every
// selected book can be removed; nothing is saved before confirmation, and a refused handover
// keeps the draft.
export function LendPage() {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const startId = params.get('book');
    const receiverId = useId();
    const [selected, setSelected] = useState<LendingBook[] | null>(startId ? null : []);
    const [startMissing, setStartMissing] = useState(false);
    const [name, setName] = useState('');
    const [decision, setDecision] = useState<ReceiverDecision>({ kind: 'typed' });
    // Suggestions and books found are kept with the text they answer, so an answer to an
    // earlier text is never shown for the current one.
    const [suggested, setSuggested] = useState<{ key: string; receivers: ReceiverDto[] }>({
        key: '',
        receivers: [],
    });
    const [similar, setSimilar] = useState<SimilarReceivers | null>(null);
    const [search, setSearch] = useState('');
    const [found, setFound] = useState<{ search: string; books: LendingBook[] } | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const leaving = useRef(false);
    const typedKey = BookDraft.nameKey(name);
    const suggestions = typedKey && suggested.key === typedKey ? suggested.receivers : [];
    const existing =
        decision.kind === 'existing'
            ? decision.receiver
            : suggestions.find((receiver) => BookDraft.nameKey(receiver.name) === typedKey);
    const chosen = selected ?? [];
    const lendable = chosen.filter((book) => LendingChoice.availability(book, []) === 'available');
    const changed =
        name.trim() !== '' ||
        chosen.length !== (startId && !startMissing ? 1 : 0) ||
        (startId !== null && chosen[0]?.id !== startId);
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            changed && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
    );

    useEffect(() => {
        if (!startId) {
            return;
        }

        api.request<BookDto>('/books/' + encodeURIComponent(startId)).then(
            (book) => setSelected([fromDetails(book, locale)]),
            () => {
                setStartMissing(true);
                setSelected([]);
            },
        );
    }, [startId, locale]);

    useEffect(() => {
        if (!typedKey) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<ReceiverDto[]>('/receivers?search=' + encodeURIComponent(name.trim())).then(
                (receivers) => current && setSuggested({ key: typedKey, receivers }),
                () => current && setSuggested({ key: typedKey, receivers: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [name, typedKey]);

    useEffect(() => {
        const text = search.trim();

        if (!text) {
            return;
        }

        let current = true;
        const timer = setTimeout(() => {
            api.request<BookListPageDto>('/books?limit=8&search=' + encodeURIComponent(text)).then(
                (page) => current && setFound({ search: text, books: page.items.map(fromListing) }),
                () => current && setFound({ search: text, books: [] }),
            );
        }, 200);

        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [search]);

    const shownFound = found && found.search === search.trim() ? found : null;
    const receiverName = existing?.name ?? name.trim();
    const confirmLabel =
        chosen.length === 0
            ? t('lend.confirmEmpty')
            : !typedKey
              ? t('lend.confirmReceiver')
              : similar
                ? t('lend.confirmChoose')
                : chosen.length === 1
                  ? t('lend.confirmOne')
                  : t('lend.confirmMany', { count: chosen.length });
    const ready = chosen.length > 0 && typedKey !== '' && !similar;
    const refresh = async (ids: readonly string[]) => {
        const fresh = await Promise.all(
            ids.map((id) =>
                api.request<BookDto>('/books/' + id).then(
                    (book) => fromDetails(book, locale),
                    () => ({ ...chosen.find((book) => book.id === id)!, gone: true }),
                ),
            ),
        );

        setSelected((current) => LendingChoice.refreshed(current ?? [], fresh));
    };
    const lend = async () => {
        const receiver: ReceiverChoiceDto =
            decision.kind === 'existing'
                ? { id: decision.receiver.id }
                : {
                      name: name.trim(),
                      ...(decision.kind === 'distinct' ? { distinct: true } : {}),
                  };

        setBusy(true);
        setFailure(null);

        try {
            const result = await api.request<LendingDto>('/loans', {
                method: 'POST',
                body: { receiver, bookIds: chosen.map((book) => book.id) },
            });

            leaving.current = true;
            navigate(LoanLinks.list, {
                state: {
                    done:
                        result.loans.length === 1
                            ? t('loans.lentOne', { name: result.receiver.name })
                            : t('loans.lentMany', {
                                  count: result.loans.length,
                                  name: result.receiver.name,
                              }),
                },
            });
        } catch (error) {
            if (error instanceof ApiError && error.reason === 'receiver-similar' && error.details) {
                setSimilar(error.details as unknown as SimilarReceivers);
            } else if (error instanceof ApiError && error.reason && failures[error.reason]) {
                const ids = ((error.details?.bookIds as string[] | undefined) ?? []).filter((id) =>
                    chosen.some((book) => book.id === id),
                );
                const titles = chosen
                    .filter((book) => ids.includes(book.id))
                    .map((book) => book.title)
                    .join(', ');

                setFailure(t(failures[error.reason]!, { titles }));
                await refresh(ids);
            } else {
                setFailure(t('lend.failedOther', { reason: t(ApiErrorMessage.key(error)) }));
            }
        } finally {
            setBusy(false);
        }
    };

    if (selected === null) {
        return <LoadingState label={t('common.loading')} />;
    }

    const statusText = (availability: LendingAvailability, book: LendingBook) => {
        switch (availability) {
            case 'lent':
                return t('lend.alreadyLent', { name: book.loan?.receiverName ?? '' });
            case 'not-owned':
                return t('lend.notOwned');
            case 'gone':
                return t('lend.gone');
            case 'selected':
                return t('lend.inSelection');
            default:
                return t('lend.available');
        }
    };

    return (
        <>
            <PageHeader title={t('lend.title')} intro={t('lend.intro')} />
            <div className="lend-layout">
                <div className="stack">
                    {startMissing && <Notice tone="warning">{t('lend.startMissing')}</Notice>}
                    {failure && (
                        <Notice tone="error">
                            <strong>{t('lend.failedTitle')}</strong> {failure}
                        </Notice>
                    )}
                    <Panel>
                        <TextField
                            label={t('lend.receiver')}
                            required
                            maxLength={100}
                            autoComplete="off"
                            placeholder={t('lend.receiverPlaceholder')}
                            list={receiverId + '-suggestions'}
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setDecision({ kind: 'typed' });
                                setSimilar(null);
                            }}
                        />
                        <datalist id={receiverId + '-suggestions'}>
                            {suggestions.map((receiver) => (
                                <option key={receiver.id} value={receiver.name} />
                            ))}
                        </datalist>
                        {typedKey && !similar && (
                            <p className="field__hint">
                                {decision.kind === 'distinct'
                                    ? t('lend.receiverDistinct', { name: name.trim() })
                                    : existing
                                      ? t('lend.receiverExisting')
                                      : t('lend.receiverNew')}
                            </p>
                        )}
                        {similar && (
                            <div className="similar-receiver" role="group" aria-live="polite">
                                <p className="similar-receiver__title">
                                    {similar.candidates.length === 1
                                        ? t('lend.similarTitle', {
                                              name: similar.candidates[0]!.name,
                                          })
                                        : t('lend.similarManyTitle')}
                                </p>
                                <p className="muted">{t('lend.similarBody')}</p>
                                <div className="actions">
                                    {similar.candidates.map((candidate) => (
                                        <Button
                                            key={candidate.id}
                                            onClick={() => {
                                                setName(candidate.name);
                                                setDecision({
                                                    kind: 'existing',
                                                    receiver: candidate,
                                                });
                                                setSimilar(null);
                                            }}
                                        >
                                            {t('lend.similarUse', { name: candidate.name })}
                                        </Button>
                                    ))}
                                    <Button
                                        onClick={() => {
                                            setDecision({ kind: 'distinct' });
                                            setSimilar(null);
                                        }}
                                    >
                                        {t('lend.similarCreate', { name: similar.name })}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <p className="muted">{t('lend.receiverHint')}</p>
                    </Panel>
                    <Panel label={t('lend.selected', { count: chosen.length })}>
                        {chosen.length === 0 ? (
                            <p className="muted">{t('lend.selectionEmpty')}</p>
                        ) : (
                            <ul
                                className="lend-list"
                                aria-label={t('lend.selected', { count: chosen.length })}
                            >
                                {chosen.map((book) => {
                                    const availability = LendingChoice.availability(book, []);

                                    return (
                                        <li key={book.id} className="lend-row">
                                            <div className="lend-row__book">
                                                <span className="lend-row__title">
                                                    {book.title}
                                                </span>
                                                <span className="muted">
                                                    {[book.authors.join(', '), book.edition]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </span>
                                                {availability !== 'available' && (
                                                    <span className="lend-row__problem">
                                                        {statusText(availability, book)}
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                aria-label={t('lend.removeNamed', {
                                                    title: book.title,
                                                })}
                                                onClick={() =>
                                                    setSelected(
                                                        chosen.filter(
                                                            (other) => other.id !== book.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                {t('lend.remove')}
                                            </Button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <p className="muted">{t('lend.selectionHint')}</p>
                    </Panel>
                    <Panel label={t('lend.addBooks')}>
                        <TextField
                            label={t('lend.find')}
                            type="search"
                            placeholder={t('lend.findPlaceholder')}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {shownFound && shownFound.books.length === 0 && (
                            <p className="muted">
                                {t('lend.findNone', { search: shownFound.search })}
                            </p>
                        )}
                        {shownFound && shownFound.books.length > 0 && (
                            <ul className="lend-list" aria-label={t('lend.addBooks')}>
                                {shownFound.books.map((book) => {
                                    const availability = LendingChoice.availability(book, chosen);

                                    return (
                                        <li key={book.id} className="lend-row">
                                            <div className="lend-row__book">
                                                <span className="lend-row__title">
                                                    {book.title}
                                                </span>
                                                <span className="muted">
                                                    {book.authors.join(', ')}
                                                </span>
                                                <span
                                                    className={
                                                        availability === 'available' ||
                                                        availability === 'selected'
                                                            ? 'muted'
                                                            : 'lend-row__problem'
                                                    }
                                                >
                                                    {statusText(availability, book)}
                                                </span>
                                            </div>
                                            {availability === 'available' && (
                                                <Button
                                                    icon="add"
                                                    aria-label={t('lend.addNamed', {
                                                        title: book.title,
                                                    })}
                                                    onClick={() => setSelected([...chosen, book])}
                                                >
                                                    {t('lend.add')}
                                                </Button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>
                <aside className="lend-summary panel" aria-label={t('lend.summary')}>
                    <p className="eyebrow">{t('lend.summary')}</p>
                    <p className="lend-summary__count">
                        {chosen.length === 0
                            ? t('lend.summaryNone')
                            : chosen.length === 1
                              ? t('lend.summaryOne')
                              : t('lend.summaryMany', { count: chosen.length })}
                    </p>
                    <p>
                        {receiverName
                            ? t('lend.summaryTo', { name: receiverName })
                            : t('lend.summaryNoReceiver')}
                    </p>
                    <p className="muted">{t('lend.summaryNote')}</p>
                    <div className="lend-summary__actions">
                        <Button
                            variant="primary"
                            icon="lend"
                            busy={busy}
                            disabled={!ready || lendable.length !== chosen.length}
                            onClick={() => void lend()}
                        >
                            {confirmLabel}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                navigate(
                                    startId && !startMissing ? '/books/' + startId : LoanLinks.list,
                                )
                            }
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                </aside>
            </div>
            <DiscardChangesDialog
                open={blocker.state === 'blocked'}
                onKeep={() => blocker.reset?.()}
                onDiscard={() => blocker.proceed?.()}
            />
        </>
    );
}
