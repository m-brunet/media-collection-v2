import { useNavigate } from 'react-router';
import type { BookDto } from '../../../../../packages/contracts/src/http';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Panel } from '../../shared/ui/layout';
import { LoanLinks } from './loan-links.util';

// On book details: who has a lent book and since when, with the return action for Owners and the
// administrator. Lending state is shown apart from ownership and reading status.
export function LoanPanel({ book, editor }: { book: BookDto; editor: boolean }) {
    const { t, dates } = useI18n();
    const navigate = useNavigate();

    if (!book.loan) {
        return null;
    }

    const loan = book.loan;

    return (
        <Panel label={t('details.lentTo', { name: loan.receiverName })} className="loan-panel">
            <p>{t('details.lentOn', { date: dates.date(loan.lentAt) })}</p>
            <p className="muted">{t('details.lentHint')}</p>
            {editor && (
                <div className="actions">
                    <Button
                        icon="lend-return"
                        onClick={() => navigate(LoanLinks.returns(loan.receiverId, loan.id))}
                    >
                        {t('details.recordReturn')}
                    </Button>
                </div>
            )}
        </Panel>
    );
}
