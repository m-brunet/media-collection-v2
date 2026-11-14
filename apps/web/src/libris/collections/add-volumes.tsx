import { useEffect, useMemo, useState } from 'react';
import type {
    BookOwnership,
    CollectionDetailsDto,
    MissingVolumeRowDto,
    MissingVolumesDto,
    VolumesAddedDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';
import { CoverPicker } from '../books/cover-picker';
import { useVolumeCovers } from './use-volume-covers';
import type { VolumeCovers } from './volume-cover-queue';
import type { FoundVolumes, VolumeChoice } from './volume-review.util';
import { VolumeReview } from './volume-review.util';

export type VolumesSaved = { result: VolumesAddedDto; coversFailed: boolean };

export function AddVolumesDialog({
    collection,
    open,
    onClose,
    onFound,
}: {
    collection: CollectionDetailsDto;
    open: boolean;
    onClose(): void;
    onFound(found: FoundVolumes): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const [upTo, setUpTo] = useState('');
    const [outcome, setOutcome] = useState<string | null>(null);
    const search = () => {
        const volume = Number(upTo);

        setOutcome(null);

        if (upTo.trim() === '' || !Number.isInteger(volume) || volume < 0) {
            action.fail('volumes.upToInvalid');

            return;
        }

        void action.run(async () => {
            const found = await api.request<MissingVolumesDto>(
                '/collections/' + collection.id + '/missing-volumes/search',
                { method: 'POST', body: { upTo: volume } },
            );

            if (found.kind === 'edition-not-found') {
                setOutcome(t('volumes.editionNotFound'));
            } else if (found.kind === 'unavailable') {
                setOutcome(t('volumes.unavailable'));
            } else if (found.rows.length === 0) {
                setOutcome(t('volumes.noneMissing', { upTo: volume }));
            } else {
                onFound(found);
            }
        });
    };

    return (
        <Dialog
            open={open}
            title={t('volumes.dialogTitle')}
            onClose={onClose}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button variant="primary" busy={action.busy} onClick={search}>
                        {t('volumes.search')}
                    </Button>
                </>
            }
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    search();
                }}
            >
                <TextField
                    label={t('volumes.upTo')}
                    hint={t('volumes.upToHint')}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    required
                    value={upTo}
                    onChange={(event) => setUpTo(event.target.value)}
                />
            </form>
            {outcome && <Notice tone="info">{outcome}</Notice>}
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
        </Dialog>
    );
}

function PickedCover({ volume, file }: { volume: number; file: File }) {
    const { t } = useI18n();
    const preview = useMemo(() => URL.createObjectURL(file), [file]);

    useEffect(() => () => URL.revokeObjectURL(preview), [preview]);

    return (
        <img
            className="volume-review__cover"
            src={preview}
            alt={t('volumes.coverAlt', { volume })}
        />
    );
}

function CoverCell({
    row,
    choice,
    covers,
    onChange,
}: {
    row: MissingVolumeRowDto;
    choice: VolumeChoice;
    covers: VolumeCovers;
    onChange(changes: Partial<VolumeChoice>): void;
}) {
    const { t } = useI18n();
    const [picking, setPicking] = useState(false);
    const isbn13 = choice.ticked ? choice.isbn13 : null;
    const cover = isbn13 ? covers.get(isbn13) : undefined;

    if (!isbn13) {
        return null;
    }

    if (choice.cover) {
        return <PickedCover volume={row.volume} file={choice.cover} />;
    }

    if (cover?.kind === 'found') {
        return (
            <img
                className="volume-review__cover"
                src={'/api/books/lookups/covers/' + cover.token}
                alt={t('volumes.coverAlt', { volume: row.volume })}
            />
        );
    }

    return (
        <div className="volume-review__no-cover">
            <span className="muted">{t(cover ? 'volumes.coverNone' : 'volumes.coverPending')}</span>
            <Button
                variant="ghost"
                aria-label={t('volumes.coverFindOf', { volume: row.volume })}
                onClick={() => setPicking(true)}
            >
                {t('volumes.coverFind')}
            </Button>
            {picking && (
                <Dialog
                    open
                    title={t('volumes.coverFindOf', { volume: row.volume })}
                    onClose={() => setPicking(false)}
                    footer={
                        <Button variant="primary" onClick={() => setPicking(false)}>
                            {t('volumes.coverDone')}
                        </Button>
                    }
                >
                    <div className="volume-review__picker">
                        <CoverPicker
                            title={VolumeReview.title(row, choice)}
                            savedCover={null}
                            searchTerms={isbn13}
                            choice={{ file: choice.cover, removed: false }}
                            onChange={(picked) => {
                                onChange({ cover: picked.file });

                                if (picked.file) {
                                    setPicking(false);
                                }
                            }}
                        />
                    </div>
                </Dialog>
            )}
        </div>
    );
}

function BookCell({
    row,
    choice,
    onChange,
}: {
    row: MissingVolumeRowDto;
    choice: VolumeChoice;
    onChange(changes: Partial<VolumeChoice>): void;
}) {
    const { t } = useI18n();
    const choosable = VolumeReview.choosable(row);
    const edition = VolumeReview.edition(row, choice);

    if (row.editions.length === 0) {
        return <span className="muted">{t('volumes.notFound')}</span>;
    }

    if (choosable.length === 0) {
        return <span className="muted">{t('volumes.inLibrary')}</span>;
    }

    const option = (isbn: string, year: number | null) =>
        year === null
            ? t('volumes.editionOptionNoYear', { isbn })
            : t('volumes.editionOption', { isbn, year });

    return (
        <div className="volume-review__book">
            <strong>{VolumeReview.title(row, choice)}</strong>
            {row.generatedTitle && edition?.title && edition.title !== row.generatedTitle && (
                <span className="volume-review__suggestion">
                    {choice.sourceTitle ? (
                        <Button variant="ghost" onClick={() => onChange({ sourceTitle: false })}>
                            {t('volumes.useGeneratedTitle', { title: row.generatedTitle })}
                        </Button>
                    ) : (
                        <>
                            <span className="muted">
                                {t('volumes.suggests', { title: edition.title })}
                            </span>
                            <Button variant="ghost" onClick={() => onChange({ sourceTitle: true })}>
                                {t('volumes.useSourceTitle')}
                            </Button>
                        </>
                    )}
                </span>
            )}
            {choosable.length > 1 ? (
                <select
                    className="field__control field__control--select"
                    aria-label={t('volumes.edition', { volume: row.volume })}
                    value={choice.isbn13 ?? ''}
                    onChange={(event) => onChange({ isbn13: event.target.value, cover: null })}
                >
                    {choosable.map((candidate) => (
                        <option key={candidate.isbn13} value={candidate.isbn13}>
                            {option(candidate.isbn13, candidate.publicationYear)}
                        </option>
                    ))}
                </select>
            ) : (
                edition && (
                    <span className="muted">{option(edition.isbn13, edition.publicationYear)}</span>
                )
            )}
        </div>
    );
}

export function VolumeReviewPanel({
    found,
    onCancel,
    onSaved,
}: {
    found: FoundVolumes;
    onCancel(): void;
    onSaved(saved: VolumesSaved): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const [choices, setChoices] = useState(() => VolumeReview.initial(found));
    const wanted = useMemo(() => VolumeReview.covers(found, choices), [found, choices]);
    const covers = useVolumeCovers(wanted);
    const count = VolumeReview.chosen(found, choices).length;
    const change = (index: number, changes: Partial<VolumeChoice>) =>
        setChoices((current) =>
            current.map((choice, position) =>
                position === index ? { ...choice, ...changes } : choice,
            ),
        );
    const everyOwnership = (ownership: BookOwnership) =>
        setChoices((current) => current.map((choice) => ({ ...choice, ownership })));
    const save = () =>
        void action.run(async () => {
            const request = VolumeReview.request(found, choices);
            const result = await api.request<VolumesAddedDto>('/books/volumes', {
                method: 'POST',
                body: request,
            });
            let coversFailed = false;

            for (const added of result.added) {
                const picked = choices.find((choice) => choice.volume === added.volume)?.cover;
                const isbn = request.volumes.find((volume) => volume.volume === added.volume)?.isbn;
                const cover = isbn ? covers.get(isbn) : undefined;
                const token = cover?.kind === 'found' ? cover.token : null;

                if (!picked && !token) {
                    continue;
                }

                try {
                    const image = picked ?? (await api.download('/books/lookups/covers/' + token));

                    await api.request('/books/' + added.bookId + '/cover', {
                        method: 'PUT',
                        file: image,
                    });
                } catch {
                    coversFailed = true;
                }
            }

            onSaved({ result, coversFailed });
        });

    return (
        <section className="panel volume-review" aria-label={t('volumes.reviewTitle')}>
            <div className="volume-review__header">
                <div>
                    <h2 className="panel__title">{t('volumes.reviewTitle')}</h2>
                    <p className="muted">
                        {t('volumes.reviewHint', { volume: found.anchor.volume })}
                    </p>
                </div>
                <div className="actions">
                    <span className="muted">{t('volumes.ownershipAll')}</span>
                    {BookFormat.ownerships.map((ownership) => (
                        <Button key={ownership} onClick={() => everyOwnership(ownership)}>
                            {t(BookFormat.ownership(ownership))}
                        </Button>
                    ))}
                </div>
            </div>
            <div className="volume-review__scroll">
                <table className="table">
                    <thead>
                        <tr>
                            <th scope="col">{t('volumes.column.volume')}</th>
                            <th scope="col">{t('volumes.column.cover')}</th>
                            <th scope="col">{t('volumes.column.book')}</th>
                            <th scope="col">{t('volumes.column.ownership')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {found.rows.map((row, index) => {
                            const choice = choices[index];

                            if (!choice) {
                                return null;
                            }

                            const available = VolumeReview.choosable(row).length > 0;

                            return (
                                <tr key={row.volume}>
                                    <td>
                                        <label className="volume-review__tick">
                                            <input
                                                type="checkbox"
                                                aria-label={t('volumes.tick', {
                                                    volume: row.volume,
                                                })}
                                                checked={choice.ticked}
                                                disabled={!available}
                                                onChange={(event) =>
                                                    change(index, { ticked: event.target.checked })
                                                }
                                            />
                                            {row.volume}
                                        </label>
                                    </td>
                                    <td>
                                        <CoverCell
                                            row={row}
                                            choice={choice}
                                            covers={covers}
                                            onChange={(changes) => change(index, changes)}
                                        />
                                    </td>
                                    <td>
                                        <BookCell
                                            row={row}
                                            choice={choice}
                                            onChange={(changes) => change(index, changes)}
                                        />
                                    </td>
                                    <td>
                                        {available && (
                                            <select
                                                className="field__control field__control--select"
                                                aria-label={t('volumes.ownershipOf', {
                                                    volume: row.volume,
                                                })}
                                                value={choice.ownership}
                                                onChange={(event) =>
                                                    change(index, {
                                                        ownership: event.target
                                                            .value as BookOwnership,
                                                    })
                                                }
                                            >
                                                {BookFormat.ownerships.map((ownership) => (
                                                    <option key={ownership} value={ownership}>
                                                        {t(BookFormat.ownership(ownership))}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="muted">{t('volumes.credit')}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <div className="actions">
                <Button onClick={onCancel}>{t('common.cancel')}</Button>
                <Button variant="primary" busy={action.busy} disabled={count === 0} onClick={save}>
                    {count === 1 ? t('volumes.saveOne') : t('volumes.saveMany', { count })}
                </Button>
            </div>
        </section>
    );
}
