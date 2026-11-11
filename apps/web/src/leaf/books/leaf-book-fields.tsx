import { useState } from 'react';
import type {
    AuthorSpellingDto,
    BookcaseDto,
    BookLookupFieldsDto,
    LookupCoverDto,
} from '../../../../../packages/contracts/src/http';
import { AuthorSpellingHints } from '../../shared/book-form/author-spelling-hints';
import { AuthorSpellings } from '../../shared/book-form/author-spellings.util';
import type { BookDraftValues, DraftFieldSetter } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { CoverChoice } from '../../shared/book-form/cover-choice';
import type { LookupField } from '../../shared/book-form/lookup-fill.util';
import { LookupFill } from '../../shared/book-form/lookup-fill.util';
import type { BookField } from '../../shared/book-form/use-book-save';
import { useSourceNames } from '../../shared/book-form/use-source-names';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { SelectField } from '../../shared/ui/select-field';
import { TextAreaField, TextField } from '../../shared/ui/text-field';
import { LeafCoverField } from './leaf-cover-field';

export interface LeafFieldsProps {
    values: BookDraftValues;
    set: DraftFieldSetter;
    update(changes: Partial<BookDraftValues>): void;
    errorFor(field: BookField): string | undefined;
    lookup: BookLookupFieldsDto | null;
    authorSpellings: AuthorSpellingDto[];
    covers: LookupCoverDto[];
    cover: CoverChoice;
    setCover(choice: CoverChoice): void;
    bookcases: BookcaseDto[];
    additionalOpen: boolean;
    setAdditionalOpen(open: boolean): void;
}

function Alternatives({
    field,
    props,
}: {
    field: LookupField;
    props: Pick<LeafFieldsProps, 'values' | 'update' | 'lookup' | 'authorSpellings'>;
}) {
    const { t } = useI18n();
    const names = useSourceNames();

    if (!props.lookup) {
        return null;
    }

    const choices = LookupFill.choices(props.lookup, field);
    const filledIn =
        field === 'authors'
            ? {
                  ...props.values,
                  authors: AuthorSpellings.asFilledIn(props.values.authors, props.authorSpellings),
              }
            : props.values;
    const held = choices.find((choice) => LookupFill.holds(filledIn, field, choice.value));
    const others = choices.filter((choice) => choice !== held);

    if (choices.length === 0) {
        return null;
    }

    return (
        <div className="leaf-alternatives">
            {held && (
                <p className="field__hint">{t('lookup.from', { sources: names(held.sources) })}</p>
            )}
            {others.map((choice) => {
                const text = LookupFill.text(field, choice.value);

                return (
                    <div key={text} className="leaf-alternatives__item">
                        <span className="leaf-alternatives__text">
                            {t('leaf.form.alternative', {
                                value: text,
                                sources: names(choice.sources),
                            })}
                        </span>
                        <Button
                            variant="ghost"
                            aria-label={t('leaf.form.useAlternative', { value: text })}
                            onClick={() =>
                                props.update(
                                    LookupFill.replace(
                                        props.values,
                                        LookupFill.only(field, choice.value),
                                        [field],
                                    ),
                                )
                            }
                        >
                            {t('leaf.form.use')}
                        </Button>
                    </div>
                );
            })}
        </div>
    );
}

function NameList({
    label,
    names,
    error,
    onAdd,
    onRemove,
    addLabel,
    removeLabel,
    required,
}: {
    label: string;
    names: string[];
    error?: string;
    onAdd(name: string): void;
    onRemove(index: number): void;
    addLabel: string;
    removeLabel(name: string): string;
    required?: boolean;
}) {
    const [typed, setTyped] = useState('');
    const add = () => {
        if (typed.trim()) {
            onAdd(typed.trim());
            setTyped('');
        }
    };

    return (
        <div className="leaf-names">
            <ul className="leaf-names__list" aria-label={label}>
                {names.map((name, index) => (
                    <li key={name + index} className="tag">
                        <span>{name}</span>
                        <button
                            type="button"
                            className="icon-button"
                            aria-label={removeLabel(name)}
                            onClick={() => onRemove(index)}
                        >
                            <Icon name="close" size={14} />
                        </button>
                    </li>
                ))}
            </ul>
            <div className="leaf-names__add">
                <TextField
                    label={label}
                    required={required && names.length === 0}
                    error={error}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            add();
                        }
                    }}
                />
                <Button icon="add" onClick={add} disabled={!typed.trim()}>
                    {addLabel}
                </Button>
            </div>
        </div>
    );
}

function MainFields(props: LeafFieldsProps) {
    const { t } = useI18n();
    const { values, set, update, errorFor } = props;
    const generated = BookDraft.generatedTitle(values);

    return (
        <fieldset className="leaf-form__section">
            <legend className="leaf-form__legend">{t('form.main')}</legend>
            <LeafCoverField
                isbn={values.isbn}
                covers={props.covers}
                choice={props.cover}
                onChange={props.setCover}
            />
            <TextField
                label={t('leaf.form.scannedIsbn')}
                value={values.isbn}
                readOnly
                error={errorFor('isbn')}
            />
            <TextField
                label={t('form.title')}
                required={!BookDraft.titleOptional(values)}
                hint={generated ? t('form.titleGenerated', { title: generated }) : undefined}
                error={errorFor('title')}
                value={values.title}
                onChange={(event) => set('title', event.target.value)}
            />
            <Alternatives field="title" props={props} />
            <NameList
                label={t('form.authors')}
                required
                names={values.authors.map((author) => author.name)}
                error={errorFor('authors')}
                addLabel={t('leaf.form.addAuthor')}
                removeLabel={(name) => t('form.authorRemove', { name })}
                onAdd={(name) =>
                    set('authors', [...values.authors, { id: null, name, distinct: false }])
                }
                onRemove={(index) =>
                    set(
                        'authors',
                        values.authors.filter((_, position) => position !== index),
                    )
                }
            />
            <Alternatives field="authors" props={props} />
            <AuthorSpellingHints
                authors={values.authors}
                spellings={props.authorSpellings}
                onChange={(authors) => set('authors', authors)}
            />
            <SelectField
                label={t('form.category')}
                value={values.category}
                options={BookFormat.categories.map((category) => ({
                    value: category,
                    label: t(BookFormat.category(category)),
                }))}
                onChange={(event) =>
                    update({ category: event.target.value as BookDraftValues['category'] })
                }
            />
            <SelectField
                label={t('form.ownership')}
                required
                value={values.ownership}
                options={BookFormat.ownerships.map((ownership) => ({
                    value: ownership,
                    label: t(BookFormat.ownership(ownership)),
                }))}
                onChange={(event) =>
                    set('ownership', event.target.value as BookDraftValues['ownership'])
                }
            />
            <SelectField
                label={t('form.reading')}
                required
                value={values.read ? 'read' : 'unread'}
                options={[
                    { value: 'unread', label: t(BookFormat.reading(false)) },
                    { value: 'read', label: t(BookFormat.reading(true)) },
                ]}
                onChange={(event) => set('read', event.target.value === 'read')}
            />
            <CollectionFields {...props} />
        </fieldset>
    );
}

function CollectionFields(props: LeafFieldsProps) {
    const { t } = useI18n();
    const { values, set, update, errorFor } = props;

    return (
        <div className="leaf-form__group">
            <label className="checkbox">
                <input
                    type="checkbox"
                    checked={values.inCollection}
                    onChange={(event) => update({ inCollection: event.target.checked })}
                />
                {t('form.inCollection')}
            </label>
            {values.inCollection && (
                <>
                    <TextField
                        label={t('form.collectionName')}
                        required
                        error={errorFor('collection')}
                        value={values.collectionName}
                        onChange={(event) =>
                            update({
                                collectionName: event.target.value,
                                collectionDistinct: false,
                            })
                        }
                    />
                    <SelectField
                        label={t('form.coverage')}
                        required
                        value={values.omnibus ? 'range' : 'single'}
                        options={[
                            { value: 'single', label: t('form.coverageSingle') },
                            { value: 'range', label: t('form.coverageRange') },
                        ]}
                        onChange={(event) => update({ omnibus: event.target.value === 'range' })}
                    />
                    <TextField
                        label={values.omnibus ? t('form.volumeFrom') : t('form.volume')}
                        required
                        inputMode="numeric"
                        value={values.volumeFrom}
                        onChange={(event) => update({ volumeFrom: event.target.value })}
                    />
                    {values.omnibus && (
                        <TextField
                            label={t('form.volumeTo')}
                            required
                            inputMode="numeric"
                            value={values.volumeTo}
                            onChange={(event) => set('volumeTo', event.target.value)}
                        />
                    )}
                </>
            )}
            <Alternatives field="collection" props={props} />
        </div>
    );
}

function OrganisationFields({ values, update, errorFor, bookcases }: LeafFieldsProps) {
    const { t } = useI18n();
    const shelves = bookcases.find((bookcase) => bookcase.id === values.bookcaseId)?.shelves ?? [];

    return (
        <fieldset className="leaf-form__section">
            <legend className="leaf-form__legend">{t('form.organisation')}</legend>
            <SelectField
                label={t('location.bookcase')}
                value={values.bookcaseId ?? ''}
                options={[
                    { value: '', label: t('location.unassigned') },
                    ...bookcases.map((bookcase) => ({ value: bookcase.id, label: bookcase.name })),
                ]}
                onChange={(event) =>
                    update({ bookcaseId: event.target.value || null, shelfId: null })
                }
            />
            {values.bookcaseId && (
                <SelectField
                    label={t('location.shelf')}
                    value={values.shelfId ?? ''}
                    placeholder={t('location.chooseHint')}
                    options={shelves.map((shelf) => ({ value: shelf.id, label: shelf.name }))}
                    onChange={(event) => update({ shelfId: event.target.value || null })}
                />
            )}
            {errorFor('location') && (
                <p className="field__error" role="alert">
                    {errorFor('location')}
                </p>
            )}
            <NameList
                label={t('tags.field')}
                names={values.tags.map((tag) => tag.name)}
                error={errorFor('tags')}
                addLabel={t('leaf.form.addTag')}
                removeLabel={(name) => t('tags.remove', { name })}
                onAdd={(name) => update({ tags: [...values.tags, { id: null, name }] })}
                onRemove={(index) =>
                    update({ tags: values.tags.filter((_, position) => position !== index) })
                }
            />
        </fieldset>
    );
}

function AdditionalFields(props: LeafFieldsProps) {
    const { t, locale } = useI18n();
    const { values, set, errorFor } = props;

    return (
        <details
            className="leaf-form__additional"
            open={props.additionalOpen}
            onToggle={(event) => props.setAdditionalOpen(event.currentTarget.open)}
        >
            <summary className="leaf-form__legend">{t('form.additional')}</summary>
            <TextField
                label={t('form.publisher')}
                error={errorFor('publisher')}
                value={values.publisher}
                onChange={(event) => set('publisher', event.target.value)}
            />
            <Alternatives field="publisher" props={props} />
            <SelectField
                label={t('form.publicationMonth')}
                value={values.publicationMonth}
                options={[
                    { value: '', label: t('form.monthNone') },
                    ...Array.from({ length: 12 }, (_, index) => ({
                        value: String(index + 1),
                        label: BookFormat.monthName(index + 1, locale),
                    })),
                ]}
                onChange={(event) => set('publicationMonth', event.target.value)}
            />
            <TextField
                label={t('form.publicationYear')}
                inputMode="numeric"
                error={errorFor('publication')}
                value={values.publicationYear}
                onChange={(event) => set('publicationYear', event.target.value)}
            />
            <Alternatives field="publication" props={props} />
            <TextAreaField
                label={t('form.summary')}
                value={values.summary}
                onChange={(event) => set('summary', event.target.value)}
            />
            <Alternatives field="summary" props={props} />
            <TextField
                label={t('form.pageCount')}
                inputMode="numeric"
                error={errorFor('pageCount')}
                value={values.pageCount}
                onChange={(event) => set('pageCount', event.target.value)}
            />
            <Alternatives field="pageCount" props={props} />
            <TextField
                label={t('form.price')}
                inputMode="decimal"
                hint={t('form.priceHint')}
                error={errorFor('price')}
                value={values.price}
                onChange={(event) => set('price', event.target.value)}
            />
            {values.note === null ? (
                <Button icon="add" onClick={() => set('note', '')}>
                    {t('leaf.form.addNote')}
                </Button>
            ) : (
                <>
                    <TextAreaField
                        label={t('form.personal')}
                        value={values.note}
                        onChange={(event) => set('note', event.target.value)}
                    />
                    <Button variant="ghost" onClick={() => set('note', null)}>
                        {t('form.noteRemove')}
                    </Button>
                </>
            )}
        </details>
    );
}

export function LeafBookFields(props: LeafFieldsProps) {
    return (
        <>
            <MainFields {...props} />
            <OrganisationFields {...props} />
            <AdditionalFields {...props} />
        </>
    );
}
