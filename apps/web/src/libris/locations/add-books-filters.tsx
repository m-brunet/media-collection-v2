import { useParams } from 'react-router';
import { FiltersPage } from '../filters/filters-page';
import { ShelfPlacement } from './shelf-placement.util';

export function AddBooksFilters() {
    const { shelfId = '' } = useParams();

    return <FiltersPage listing="books" returnTo={ShelfPlacement.path(shelfId)} ownedOnly />;
}
