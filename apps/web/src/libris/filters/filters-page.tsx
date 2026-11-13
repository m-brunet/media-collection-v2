import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { BookCategory, BookOwnership } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { useSession } from '../../shared/session/session-context';
import { Button } from '../../shared/ui/button';
import { PageHeader } from '../../shared/ui/layout';
import { BookFormat } from '../../shared/book-form/book-format.util';
import { useBookcases } from '../locations/use-bookcases';
import type { Filter } from './book-filter.util';
import { BookFilter } from './book-filter.util';
import {
    ChoiceField,
    locationOptions,
    SearchedChoices,
    searchAuthors,
    searchCollections,
} from './filter-fields';
import { useFilterLabels } from './use-filter-labels';
import { TagFilter } from './tag-filter';

export function FiltersPage({ listing }: { listing: 'books' | 'collections' }) {
    const { t } = useI18n();
    const { account } = useSession();
    const navigate = useNavigate();
    const [parameters] = useSearchParams();
    const guest = account?.role === 'guest';
    const collections = listing === 'collections';
    const [filter, setFilter] = useState<Filter>(() =>
        BookFilter.applicable(BookFilter.read(parameters), { guest, collections }),
    );
    const { bookcases } = useBookcases();
    const label = useFilterLabels(filter);
    const summary = (
        key: 'category' | 'location' | 'ownership' | 'cover' | 'price' | 'reading',
        any: string,
    ) => filter[key].map((value) => label({ key, value })).join(' · ') || any;

    return (
        <>
            <PageHeader
                title={t('filters.title')}
                intro={collections ? t('filters.introCollections') : t('filters.intro')}
            />
            <form
                className="stack"
                onSubmit={(event) => {
                    event.preventDefault();
                    navigate('/' + listing + '?' + BookFilter.write(filter, parameters).toString());
                }}
            >
                <div className="filters">
                    <section className="panel form" aria-labelledby="book-criteria">
                        <h2 id="book-criteria" className="eyebrow">
                            {t('filters.bookCriteria')}
                        </h2>
                        <ChoiceField
                            label={t('filters.category')}
                            summary={summary('category', t('filters.anyCategory'))}
                            options={BookFormat.categories.map((category: BookCategory) => ({
                                value: category,
                                label: t(BookFormat.category(category)),
                            }))}
                            filter={filter}
                            field="category"
                            onChange={setFilter}
                        />
                        <SearchedChoices
                            label={t('filters.authors')}
                            placeholder={t('filters.searchAuthors')}
                            anyLabel={t('filters.anyAuthor')}
                            field="author"
                            filter={filter}
                            search={searchAuthors}
                            onChange={setFilter}
                        />
                        {!collections && (
                            <SearchedChoices
                                label={t('filters.collection')}
                                hint={t('filters.collectionHint')}
                                placeholder={t('filters.searchCollections')}
                                anyLabel={t('filters.anyCollection')}
                                fixed={[{ value: 'none', label: t('filters.noCollection') }]}
                                field="collection"
                                filter={filter}
                                search={searchCollections}
                                onChange={setFilter}
                            />
                        )}
                        <ChoiceField
                            label={t('filters.location')}
                            hint={t('filters.locationHint')}
                            summary={summary('location', t('filters.anyLocation'))}
                            options={locationOptions(bookcases ?? [], t('filters.noLocation'))}
                            filter={filter}
                            field="location"
                            onChange={setFilter}
                        />
                    </section>
                    <section className="panel form" aria-labelledby="other-criteria">
                        <h2 id="other-criteria" className="eyebrow">
                            {guest ? t('filters.otherCriteriaGuest') : t('filters.otherCriteria')}
                        </h2>
                        <div className="choice-field-pairs">
                            <ChoiceField
                                label={t('filters.ownership')}
                                summary={summary('ownership', t('filters.anyOwnership'))}
                                options={BookFormat.ownerships.map((ownership: BookOwnership) => ({
                                    value: ownership,
                                    label: t(BookFormat.ownership(ownership)),
                                }))}
                                filter={filter}
                                field="ownership"
                                onChange={setFilter}
                            />
                            <ChoiceField
                                label={t('filters.cover')}
                                summary={summary('cover', t('filters.anyCover'))}
                                options={[
                                    { value: 'with', label: t('filters.withCover') },
                                    { value: 'without', label: t('filters.withoutCover') },
                                ]}
                                filter={filter}
                                field="cover"
                                onChange={setFilter}
                            />
                            <ChoiceField
                                label={t('filters.price')}
                                summary={summary('price', t('filters.anyPrice'))}
                                options={[
                                    { value: 'with', label: t('filters.withPrice') },
                                    { value: 'without', label: t('filters.withoutPrice') },
                                ]}
                                filter={filter}
                                field="price"
                                onChange={setFilter}
                            />
                            {!guest && (
                                <ChoiceField
                                    label={t('filters.reading')}
                                    summary={summary('reading', t('filters.anyReading'))}
                                    options={[
                                        { value: 'read', label: t('status.read') },
                                        { value: 'unread', label: t('status.notRead') },
                                    ]}
                                    filter={filter}
                                    field="reading"
                                    onChange={setFilter}
                                />
                            )}
                        </div>
                        <TagFilter filter={filter} onChange={setFilter} />
                    </section>
                </div>
                <p className="muted">{t('filters.logic')}</p>
                <div className="actions">
                    <Button type="submit" variant="primary">
                        {t('filters.show')}
                    </Button>
                    <Button onClick={() => setFilter(BookFilter.empty())}>
                        {t('filters.clear')}
                    </Button>
                </div>
            </form>
        </>
    );
}
