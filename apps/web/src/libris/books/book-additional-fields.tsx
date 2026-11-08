import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { SelectField } from '../../shared/ui/select-field';
import { TextAreaField, TextField } from '../../shared/ui/text-field';
import type { BookDraftValues, DraftFieldSetter } from '../../shared/book-form/book-draft.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { BookField } from '../../shared/book-form/use-book-save';

// "Additional information" of the book form, folded by default: publisher, publication date,
// summary, page count, price, and the person's own note.
export function BookAdditionalFields({
    id,
    expanded,
    onToggle,
    values,
    set,
    errorFor,
    personal,
}: {
    // Identifies the folded part for the toggle button.
    id: string;
    expanded: boolean;
    onToggle(): void;
    values: BookDraftValues;
    set: DraftFieldSetter;
    errorFor(field: BookField): string | undefined;
    // Whether the account has personal notes (not a Guest).
    personal: boolean;
}) {
    const { t, locale } = useI18n();

    return (
        <section className="panel">
            <h2 className="eyebrow book-form__toggle-heading">
                <button
                    type="button"
                    className="book-form__toggle"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={onToggle}
                >
                    <Icon name={expanded ? 'collapse' : 'expand'} size={12} />
                    {t('form.additional')}
                </button>
            </h2>
            {!expanded && <p className="muted">{t('form.additionalHint')}</p>}
            <div id={id} className="form" hidden={!expanded}>
                <div className="book-form__row book-form__row--two">
                    <TextField
                        label={t('form.publisher')}
                        maxLength={200}
                        error={errorFor('publisher')}
                        value={values.publisher}
                        onChange={(event) => set('publisher', event.target.value)}
                    />
                    <div className="book-form__row book-form__row--two">
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
                            maxLength={4}
                            error={errorFor('publication')}
                            value={values.publicationYear}
                            onChange={(event) => set('publicationYear', event.target.value)}
                        />
                    </div>
                </div>
                <TextAreaField
                    label={t('form.summary')}
                    maxLength={5000}
                    value={values.summary}
                    onChange={(event) => set('summary', event.target.value)}
                />
                {errorFor('summary') && <p className="field__error">{errorFor('summary')}</p>}
                <div className="book-form__row book-form__row--two">
                    <TextField
                        label={t('form.pageCount')}
                        inputMode="numeric"
                        maxLength={6}
                        error={errorFor('pageCount')}
                        value={values.pageCount}
                        onChange={(event) => set('pageCount', event.target.value)}
                    />
                    <TextField
                        label={t('form.price')}
                        inputMode="decimal"
                        maxLength={12}
                        hint={t('form.priceHint')}
                        error={errorFor('price')}
                        value={values.price}
                        onChange={(event) => set('price', event.target.value)}
                    />
                </div>
                {personal && (
                    <div className="form">
                        <p className="eyebrow">{t('form.personal')}</p>
                        {values.note === null ? (
                            <div className="actions">
                                <Button icon="add" onClick={() => set('note', '')}>
                                    {t('details.noteAdd')}
                                </Button>
                            </div>
                        ) : (
                            <>
                                <TextAreaField
                                    label={t('details.noteLabel')}
                                    maxLength={5000}
                                    value={values.note}
                                    onChange={(event) => set('note', event.target.value)}
                                />
                                {errorFor('note') && (
                                    <p className="field__error">{errorFor('note')}</p>
                                )}
                                <div className="actions">
                                    <Button
                                        variant="ghost"
                                        icon="delete"
                                        onClick={() => set('note', null)}
                                    >
                                        {t('form.noteRemove')}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
