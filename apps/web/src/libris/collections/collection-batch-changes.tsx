import type { ReactNode } from 'react';
import { useId } from 'react';
import type { BookcaseDto } from '../../../../../packages/contracts/src/http';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';
import { TextField } from '../../shared/ui/text-field';
import { AuthorPicker } from '../books/author-picker';
import { LocationField } from '../books/location-field';
import { TagPicker } from '../books/tag-picker';
import { useBookcases } from '../locations/use-bookcases';
import type { BatchDraft, BatchField, ChoiceMode, TextChoice } from './collection-batch.util';
import { CollectionBatch } from './collection-batch.util';
import { BatchChoice } from './collection-batch-choice';

type ValueMode = Exclude<ChoiceMode, 'keep'>;

const fillHints: Record<'publisher' | 'price' | 'shelf', Record<ValueMode, MessageKey | null>> = {
    publisher: { set: null, fill: 'batch.fillHint.publisher', clear: 'batch.clearHint.publisher' },
    price: { set: 'batch.priceHint', fill: 'batch.fillHint.price', clear: 'batch.clearHint.price' },
    shelf: { set: null, fill: 'batch.fillHint.shelf', clear: 'batch.clearHint.shelf' },
};

function ChangeCard({
    field,
    onRemove,
    children,
}: {
    field: BatchField;
    onRemove(): void;
    children(titleId: string): ReactNode;
}) {
    const { t } = useI18n();
    const titleId = useId();
    const label = t(CollectionBatch.fieldLabel(field));

    return (
        <section className={'batch-card batch-card--' + field} aria-labelledby={titleId}>
            <div className="batch-card__header">
                <h3 id={titleId} className="batch-card__title">
                    {label}
                </h3>
                <button
                    type="button"
                    className="icon-button"
                    aria-label={t('batch.removeField', { field: label })}
                    onClick={onRemove}
                >
                    <Icon name="close" size={16} />
                </button>
            </div>
            {children(titleId)}
        </section>
    );
}

function ValueModes({
    titleId,
    setLabel,
    mode,
    onChange,
}: {
    titleId: string;
    setLabel: MessageKey;
    mode: ChoiceMode;
    onChange(mode: ValueMode): void;
}) {
    const { t } = useI18n();

    return (
        <BatchChoice<ValueMode>
            labelledBy={titleId}
            value={mode === 'keep' ? null : mode}
            choices={[
                { value: 'set', label: t(setLabel) },
                { value: 'fill', label: t('batch.fill') },
                { value: 'clear', label: t('batch.clear') },
            ]}
            onChange={onChange}
        />
    );
}

function Hint({ field, mode }: { field: 'publisher' | 'price' | 'shelf'; mode: ChoiceMode }) {
    const { t } = useI18n();
    const hint = mode === 'keep' ? null : fillHints[field][mode];

    return hint && <p className="muted batch-card__hint">{t(hint)}</p>;
}

function TextChange({
    field,
    titleId,
    choice,
    onChange,
}: {
    field: 'publisher' | 'price';
    titleId: string;
    choice: TextChoice;
    onChange(choice: TextChoice): void;
}) {
    const { t } = useI18n();

    return (
        <>
            <ValueModes
                titleId={titleId}
                setLabel="batch.set"
                mode={choice.mode}
                onChange={(mode) => onChange({ ...choice, mode })}
            />
            {CollectionBatch.takesValue(choice.mode) && (
                <TextField
                    label={t('batch.newValue', {
                        field: t(CollectionBatch.fieldLabel(field)),
                    })}
                    inputMode={field === 'price' ? 'decimal' : undefined}
                    value={choice.value}
                    onChange={(event) => onChange({ ...choice, value: event.target.value })}
                />
            )}
            <Hint field={field} mode={choice.mode} />
        </>
    );
}

function FieldChange({
    field,
    titleId,
    draft,
    bookcases,
    onChange,
}: {
    field: BatchField;
    titleId: string;
    draft: BatchDraft;
    bookcases: BookcaseDto[] | null;
    onChange(draft: BatchDraft): void;
}) {
    const { t } = useI18n();
    const set = <K extends keyof BatchDraft>(key: K, value: BatchDraft[K]) =>
        onChange({ ...draft, [key]: value });

    switch (field) {
        case 'category':
            return (
                <BatchChoice
                    labelledBy={titleId}
                    value={draft.category === 'keep' ? null : draft.category}
                    choices={BookFormat.categories.map((category) => ({
                        value: category,
                        label: t(BookFormat.category(category)),
                    }))}
                    onChange={(category) => set('category', category)}
                />
            );
        case 'ownership':
            return (
                <BatchChoice
                    labelledBy={titleId}
                    value={draft.ownership === 'keep' ? null : draft.ownership}
                    choices={BookFormat.ownerships.map((ownership) => ({
                        value: ownership,
                        label: t(BookFormat.ownership(ownership)),
                    }))}
                    onChange={(ownership) => set('ownership', ownership)}
                />
            );
        case 'publisher':
        case 'price':
            return (
                <TextChange
                    field={field}
                    titleId={titleId}
                    choice={draft[field]}
                    onChange={(choice) => set(field, choice)}
                />
            );
        case 'shelf':
            return (
                <>
                    <ValueModes
                        titleId={titleId}
                        setLabel="batch.setShelf"
                        mode={draft.shelf.mode}
                        onChange={(mode) => set('shelf', { ...draft.shelf, mode })}
                    />
                    {CollectionBatch.takesValue(draft.shelf.mode) && bookcases && (
                        <LocationField
                            bookcases={bookcases}
                            bookcaseId={draft.shelf.bookcaseId}
                            shelfId={draft.shelf.shelfId}
                            onChange={(location) => set('shelf', { ...draft.shelf, ...location })}
                        />
                    )}
                    <Hint field="shelf" mode={draft.shelf.mode} />
                </>
            );
        case 'tags':
            return (
                <>
                    <TagPicker
                        label={t('batch.tagsAdd')}
                        existingOnly
                        tags={draft.addTags}
                        onChange={(tags) => set('addTags', tags)}
                    />
                    <TagPicker
                        label={t('batch.tagsRemove')}
                        existingOnly
                        tags={draft.removeTags}
                        onChange={(tags) => set('removeTags', tags)}
                    />
                    <p className="muted batch-card__hint">{t('batch.addTagsHint')}</p>
                </>
            );
        case 'authors':
            return (
                <>
                    <AuthorPicker
                        authors={draft.authors}
                        onChange={(authors) => set('authors', authors)}
                    />
                    <p className="muted batch-card__hint">{t('batch.authorsHint')}</p>
                </>
            );
        case 'read':
            return (
                <>
                    <BatchChoice
                        labelledBy={titleId}
                        value={draft.read === 'keep' ? null : draft.read}
                        choices={[
                            { value: 'read', label: t('status.read') },
                            { value: 'not-read', label: t('status.notRead') },
                        ]}
                        onChange={(read) => set('read', read)}
                    />
                    <p className="muted batch-card__hint">{t('batch.readingHint')}</p>
                </>
            );
        default:
            return (
                <>
                    <p className="batch-card__value">{t('batch.useGenerated')}</p>
                    <p className="muted batch-card__hint">{t('batch.titlesHint')}</p>
                </>
            );
    }
}

export function CollectionBatchChanges({
    draft,
    onChange,
}: {
    draft: BatchDraft;
    onChange(draft: BatchDraft): void;
}) {
    const { t } = useI18n();
    const { bookcases } = useBookcases();
    const chipsId = useId();
    const remaining = CollectionBatch.remaining(draft);
    const empty = draft.fields.length === 0;

    return (
        <div className="batch-changes">
            {empty && <p className="muted">{t('batch.intro')}</p>}
            {!empty && (
                <div className="batch-changes__cards">
                    {draft.fields.map((field) => (
                        <ChangeCard
                            key={field}
                            field={field}
                            onRemove={() => onChange(CollectionBatch.remove(draft, field))}
                        >
                            {(titleId) => (
                                <FieldChange
                                    field={field}
                                    titleId={titleId}
                                    draft={draft}
                                    bookcases={bookcases}
                                    onChange={onChange}
                                />
                            )}
                        </ChangeCard>
                    ))}
                </div>
            )}
            {remaining.length > 0 && (
                <div className="batch-chips" role="group" aria-labelledby={chipsId}>
                    <p id={chipsId} className="batch-chips__label">
                        {t(empty ? 'batch.addChange' : 'batch.addAnother')}
                    </p>
                    <div className="batch-chips__list">
                        {remaining.map((field) => (
                            <button
                                key={field}
                                type="button"
                                className="batch-chip"
                                onClick={() => onChange(CollectionBatch.add(draft, field))}
                            >
                                <Icon name="add" size={14} />
                                {t(CollectionBatch.fieldLabel(field))}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {empty && (
                <div className="batch-empty">
                    <p className="batch-empty__title">{t('batch.emptyTitle')}</p>
                    <p className="muted">{t('batch.emptyBody')}</p>
                </div>
            )}
        </div>
    );
}
