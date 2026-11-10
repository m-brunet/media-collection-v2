import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { LeafPage } from '../leaf-page';
import type { SavedBookState } from './add-book-page';

export function SavedPage() {
    const { t } = useI18n();
    const navigate = useNavigate();
    const state = useLocation().state as SavedBookState | null;

    if (!state?.title) {
        return <Navigate to="/" replace />;
    }

    return (
        <LeafPage title={t('leaf.saved.title')}>
            <Notice tone="success">{t('leaf.saved.body', { title: state.title })}</Notice>
            {state.followUpFailed && <Notice tone="warning">{t('form.followUpFailed')}</Notice>}
            <Button variant="primary" icon="scan" onClick={() => navigate('/scan')}>
                {t('leaf.found.scanAnother')}
            </Button>
            <Link to="/" className="button button--secondary">
                <span>{t('leaf.scan.backHome')}</span>
            </Link>
        </LeafPage>
    );
}
