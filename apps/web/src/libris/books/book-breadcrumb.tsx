import { Link } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';

export function BookBreadcrumb({ title }: { title: string }) {
    const { t } = useI18n();

    return (
        <nav aria-label={t('details.breadcrumb')} className="breadcrumb">
            <Link to="/books">{t('books.title')}</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page">{title}</span>
        </nav>
    );
}
