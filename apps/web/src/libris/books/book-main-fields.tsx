import { Link } from 'react-router';
import type { AuthorDto, BookDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Panel } from '../../shared/ui/layout';
import { SelectField } from '../../shared/ui/select-field';
import { TextField } from '../../shared/ui/text-field';
import { AuthorPicker } from './author-picker';
import type { BookDraftValues, DraftFieldSetter } from './book-draft.util';
import { BookDraft } from './book-draft.util';
import { BookFormat } from './book-format.util';
import { CollectionField } from './collection-field';
import type { CoverChoice } from './cover-picker';
import { CoverPicker } from './cover-picker';
import type { BookField } from './use-book-save';

// "01 / Main information" of the book form: ISBN (with Find book when adding), title, authors,
// category, ownership, reading status, collection, and the cover beside them.
export function BookMainFields({
    book,
    values,
    set,
    update,
    errorFor,
    personal,
    existingBookId,
    find,
    cover,
    onCoverChange,
    onCorrectAuthor,
}: {
    // The book being edited, or null when adding one.
    book: BookDto | null;
    values: BookDraftValues;
    set: DraftFieldSetter;
    update(changes: Partial<BookDraftValues>): void;
    errorFor(field: BookField): string | undefined;
    // Whether the account has a reading status (not a Guest).
    personal: boolean;
    // The saved book that already has this ISBN, linked under the field.
    existingBookId: string | null;
    // Find book, offered when adding a book.
    find: { busy: boolean; retry: boolean; onFind(): void } | null;
    cover: CoverChoice;
    onCoverChange(choice: CoverChoice): void;
    // Offered when editing: correct the spelling of an existing author.
    onCorrectAuthor?(author: AuthorDto): void;
}) {
    const { t } = useI18n();
    // A lent book stays Owned until its return is recorded.
    const lentTo = book?.loan?.receiverName ?? null;
    const titleOptional = BookDraft.titleOptional(values);
    const generatedTitle = BookDraft.generatedTitle(values);

    return (
        <Panel label={t('form.main')}>
            <div className="book-form__main">
                <div className="form">
                    <div className="book-form__isbn">
                        <div className="book-form__isbn-row">
                            <TextField
                                label={t('form.isbn')}
                                hint={book ? t('form.isbnHint') : t('lookup.findHint')}
                                error={errorFor('isbn')}
                                required={!values.noIsbn}
                                disabled={values.noIsbn}
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={40}
                                value={values.noIsbn ? '' : values.isbn}
                                onChange={(event) => set('isbn', event.target.value)}
                            />
                            {find && (
                                <Button
                                    icon="search"
                                    busy={find.busy}
                                    disabled={values.noIsbn || values.isbn.trim() === ''}
                                    onClick={find.onFind}
                                >
                                    {find.retry ? t('lookup.retry') : t('lookup.find')}
                                </Button>
                            )}
                        </div>
                        {existingBookId && (
                            <Link to={'/books/' + existingBookId} className="book-form__existing">
                                {t('form.openExisting')}
                            </Link>
                        )}
                    </div>
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={values.noIsbn}
                            onChange={(event) => set('noIsbn', event.target.checked)}
                        />
                        {t('form.noIsbn')}
                    </label>
                    <TextField
                        label={t('form.title')}
                        required={!titleOptional}
                        hint={
                            titleOptional
                                ? generatedTitle
                                    ? t('form.titleGenerated', { title: generatedTitle })
                                    : t('form.titleGeneratedLater')
                                : undefined
                        }
                        maxLength={300}
                        error={errorFor('title')}
                        value={values.title}
                        onChange={(event) => set('title', event.target.value)}
                    />
                    <AuthorPicker
                        authors={values.authors}
                        error={errorFor('authors')}
                        onChange={(authors) => set('authors', authors)}
                        onCorrect={onCorrectAuthor}
                    />
                    <div className="book-form__row">
                        <SelectField
                            label={t('form.category')}
                            value={values.category}
                            options={BookFormat.categories.map((category) => ({
                                value: category,
                                label: t(BookFormat.category(category)),
                            }))}
                            onChange={(event) =>
                                set('category', event.target.value as BookDraftValues['category'])
                            }
                        />
                        <SelectField
                            label={t('form.ownership')}
                            required
                            hint={lentTo ? t('form.ownershipLent', { name: lentTo }) : undefined}
                            value={values.ownership}
                            options={BookFormat.ownerships.map((ownership) => ({
                                value: ownership,
                                label: t(BookFormat.ownership(ownership)),
                                disabled: lentTo !== null && ownership === 'not-owned',
                            }))}
                            onChange={(event) =>
                                set('ownership', event.target.value as BookDraftValues['ownership'])
                            }
                        />
                        {personal && (
                            <SelectField
                                label={t('form.reading')}
                                required
                                value={values.read ? 'read' : 'not-read'}
                                options={[
                                    { value: 'not-read', label: t('status.notRead') },
                                    { value: 'read', label: t('status.read') },
                                ]}
                                onChange={(event) => set('read', event.target.value === 'read')}
                            />
                        )}
                    </div>
                    <CollectionField
                        values={values}
                        error={errorFor('collection')}
                        onChange={(changes) => update(changes)}
                    />
                </div>
                <CoverPicker
                    title={values.title}
                    savedCover={book?.hasCover ? BookFormat.cover(book.id, book.updatedAt) : null}
                    searchTerms={
                        values.isbn.trim() && !values.noIsbn
                            ? values.isbn.trim()
                            : [values.title, ...values.authors.map(({ name }) => name)]
                                  .join(' ')
                                  .trim()
                    }
                    choice={cover}
                    onChange={onCoverChange}
                />
            </div>
        </Panel>
    );
}
