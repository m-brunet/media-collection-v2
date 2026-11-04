import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { BookDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { PageHeader } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { EmptyState, LoadingState } from '../../shared/ui/states';

// Confirmation after adding a book: nothing was created before the person saved.
export function BookSavedPage() {
    const { t } = useI18n();
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const followUpFailed = (location.state as { followUpFailed?: boolean } | null)?.followUpFailed;
    const [title, setTitle] = useState<string | null>(null);

    useEffect(() => {
        api.request<BookDto>('/books/' + id).then(
            (book) => setTitle(book.title),
            () => navigate('/books/' + id, { replace: true }),
        );
    }, [id, navigate]);

    return (
        <>
            <PageHeader title={t('saved.title')} />
            {followUpFailed && <Notice tone="warning">{t('form.followUpFailed')}</Notice>}
            {title === null ? (
                <LoadingState label={t('common.loading')} />
            ) : (
                <EmptyState
                    icon="success"
                    title={t('saved.body', { title })}
                    action={
                        <div className="actions">
                            <Button variant="primary" onClick={() => navigate('/books/' + id)}>
                                {t('saved.view')}
                            </Button>
                            <Button onClick={() => navigate('/books/new')}>
                                {t('saved.another')}
                            </Button>
                            <Button variant="ghost" onClick={() => navigate('/books')}>
                                {t('saved.back')}
                            </Button>
                        </div>
                    }
                />
            )}
        </>
    );
}
