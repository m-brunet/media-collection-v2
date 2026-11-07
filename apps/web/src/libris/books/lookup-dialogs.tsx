import { useId, useState } from 'react';
import type {
    BookLookupFieldsDto,
    LookupCoverDto,
} from '../../../../../packages/contracts/src/http';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import type {
    LookupConflict,
    LookupField,
    LookupSelection,
} from '../../shared/book-form/lookup-fill.util';
import { LookupFill } from '../../shared/book-form/lookup-fill.util';
import { useSourceNames } from '../../shared/book-form/use-source-names';

const labels: Record<LookupField, MessageKey> = {
    title: 'form.title',
    authors: 'form.authors',
    publisher: 'form.publisher',
    publication: 'lookup.publication',
    pageCount: 'form.pageCount',
    summary: 'form.summary',
    collection: 'lookup.collection',
};

// The lookup's values for review (design VMQcQ): the preferred source's value is selected first,
// alternatives can be chosen, and nothing reaches the form before "Use these values".
export function LookupReviewDialog({
    fields,
    covers,
    keepsGeneratedTitle,
    onUse,
    onClose,
}: {
    fields: BookLookupFieldsDto;
    covers: LookupCoverDto[];
    keepsGeneratedTitle: boolean;
    onUse(selection: LookupSelection, coverToken: string | null): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const sources = useSourceNames();
    const id = useId();
    // The chosen value of each field, by position; -1 keeps the generated title.
    const [chosen, setChosen] = useState<Partial<Record<LookupField, number>>>({});
    const [cover, setCover] = useState<number | null>(null);
    const coverIndex = cover ?? (covers.length > 0 ? 0 : -1);
    const indexOf = (field: LookupField) =>
        chosen[field] ?? (field === 'title' && keepsGeneratedTitle ? -1 : 0);
    const use = () => {
        const value = <T,>(field: LookupField): T | null => {
            const index = indexOf(field);

            return index < 0
                ? null
                : ((LookupFill.choices(fields, field)[index]?.value as T | undefined) ?? null);
        };

        onUse(
            {
                title: value('title'),
                authors: value('authors'),
                publisher: value('publisher'),
                publication: value('publication'),
                pageCount: value('pageCount'),
                summary: value('summary'),
                collection: value('collection'),
            },
            coverIndex >= 0 ? covers[coverIndex]!.token : null,
        );
    };

    return (
        <Dialog
            open
            title={t('lookup.reviewTitle')}
            onClose={onClose}
            footer={
                <div className="actions">
                    <Button variant="primary" onClick={use}>
                        {t('lookup.use')}
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                </div>
            }
        >
            <div className="stack stack--compact lookup-review">
                <p className="muted">{t('lookup.reviewIntro')}</p>
                {LookupFill.fields.map((field) => {
                    const choices = LookupFill.choices(fields, field);
                    const keepOption = field === 'title' && keepsGeneratedTitle;

                    if (choices.length === 0) {
                        return null;
                    }

                    if (choices.length === 1 && !keepOption) {
                        return (
                            <div key={field} className="lookup-review__field">
                                <p className="field__label">{t(labels[field])}</p>
                                <p className="lookup-review__value">
                                    {LookupDisplay.text(field, choices[0]!.value, t)}{' '}
                                    <span className="muted">
                                        {t('lookup.from', {
                                            sources: sources(choices[0]!.sources),
                                        })}
                                    </span>
                                </p>
                            </div>
                        );
                    }

                    return (
                        <fieldset key={field} className="lookup-review__field">
                            <legend className="field__label">{t(labels[field])}</legend>
                            {keepOption && (
                                <label className="checkbox">
                                    <input
                                        type="radio"
                                        name={id + field}
                                        checked={indexOf(field) === -1}
                                        onChange={() => setChosen({ ...chosen, [field]: -1 })}
                                    />
                                    {t('lookup.keepGenerated')}
                                </label>
                            )}
                            {choices.map((choice, index) => (
                                <label key={index} className="checkbox">
                                    <input
                                        type="radio"
                                        name={id + field}
                                        checked={indexOf(field) === index}
                                        onChange={() => setChosen({ ...chosen, [field]: index })}
                                    />
                                    <span>
                                        {LookupDisplay.text(field, choice.value, t)}{' '}
                                        <span className="muted">
                                            {t('lookup.from', { sources: sources(choice.sources) })}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    );
                })}
                {covers.length > 0 && (
                    <fieldset className="lookup-review__field">
                        <legend className="field__label">{t('lookup.cover')}</legend>
                        <div className="lookup-review__covers">
                            {covers.map((offer, index) => {
                                const label = t('lookup.coverOption', {
                                    number: index + 1,
                                    sources: sources(offer.sources),
                                });

                                return (
                                    <label key={offer.token} className="lookup-review__cover">
                                        <img
                                            src={'/api/books/lookups/covers/' + offer.token}
                                            alt={label}
                                        />
                                        <span className="checkbox">
                                            <input
                                                type="radio"
                                                name={id + 'cover'}
                                                checked={coverIndex === index}
                                                onChange={() => setCover(index)}
                                            />
                                            {label}
                                        </span>
                                    </label>
                                );
                            })}
                            <label className="checkbox">
                                <input
                                    type="radio"
                                    name={id + 'cover'}
                                    checked={coverIndex === -1}
                                    onChange={() => setCover(-1)}
                                />
                                {t('lookup.noCover')}
                            </label>
                        </div>
                    </fieldset>
                )}
            </div>
        </Dialog>
    );
}

// Fields the person already filled differently (design OGDgW): one row per field, keeping their
// value unless they choose the lookup's.
export function LookupConflictsDialog({
    conflicts,
    onApply,
    onClose,
}: {
    conflicts: LookupConflict[];
    onApply(replaced: LookupField[]): void;
    onClose(): void;
}) {
    const { t } = useI18n();
    const id = useId();
    const [replaced, setReplaced] = useState<LookupField[]>([]);
    const choose = (field: LookupField, replace: boolean) =>
        setReplaced((current) =>
            replace ? [...current, field] : current.filter((entry) => entry !== field),
        );

    return (
        <Dialog
            open={conflicts.length > 0}
            title={t('lookup.conflictsTitle')}
            onClose={onClose}
            footer={
                <div className="actions">
                    <Button variant="primary" onClick={() => onApply(replaced)}>
                        {t('lookup.apply')}
                    </Button>
                </div>
            }
        >
            <div className="stack stack--compact">
                <p className="muted">{t('lookup.conflictsIntro')}</p>
                {conflicts.map((conflict) => (
                    <fieldset key={conflict.field} className="lookup-review__field">
                        <legend className="field__label">{t(labels[conflict.field])}</legend>
                        <label className="checkbox">
                            <input
                                type="radio"
                                name={id + conflict.field}
                                checked={!replaced.includes(conflict.field)}
                                onChange={() => choose(conflict.field, false)}
                            />
                            {t('lookup.keepMine')} — {t('lookup.yours', { value: conflict.mine })}
                        </label>
                        <label className="checkbox">
                            <input
                                type="radio"
                                name={id + conflict.field}
                                checked={replaced.includes(conflict.field)}
                                onChange={() => choose(conflict.field, true)}
                            />
                            {t('lookup.useLookup')} —{' '}
                            {t('lookup.theirs', { value: conflict.lookup })}
                        </label>
                    </fieldset>
                ))}
            </div>
        </Dialog>
    );
}

// How a lookup value reads in the review.
class LookupDisplay {
    static text(field: LookupField, value: unknown, t: ReturnType<typeof useI18n>['t']): string {
        switch (field) {
            case 'authors':
                return (value as string[]).join(', ');
            case 'publication': {
                const date = value as { year: number; month: number | null };

                return date.month ? date.month + '/' + date.year : String(date.year);
            }
            case 'collection': {
                const series = value as { name: string; volume: number };

                return t('lookup.collectionValue', { name: series.name, volume: series.volume });
            }
            default:
                return String(value);
        }
    }
}
