import type { AccountSummary } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { RoleLabel } from '../../shared/role-label.util';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';

// Confirms deactivating an active account or reactivating a deactivated one.
export function AccountStatusDialog({
    account,
    onClose,
    onChanged,
}: {
    account: AccountSummary | null;
    onClose(): void;
    onChanged(account: AccountSummary): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const deactivating = account?.active ?? true;
    const values = {
        username: account?.username ?? '',
        role: account ? t(RoleLabel.name(account.role)) : '',
    };
    const confirm = () => {
        if (!account) {
            return;
        }

        void action.run(async () => {
            onChanged(
                await api.request<AccountSummary>(
                    '/users/' + account.id + (deactivating ? '/deactivation' : '/reactivation'),
                    { method: 'POST' },
                ),
            );
        });
    };

    return (
        <Dialog
            open={account !== null}
            title={t(
                deactivating ? 'accounts.deactivateTitle' : 'accounts.reactivateTitle',
                values,
            )}
            onClose={() => {
                action.setFeedback(null);
                onClose();
            }}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button
                        variant={deactivating ? 'danger' : 'primary'}
                        busy={action.busy}
                        onClick={confirm}
                    >
                        {t(deactivating ? 'accounts.deactivate' : 'accounts.reactivate')}
                    </Button>
                </>
            }
        >
            <div className="form">
                <p>
                    {t(
                        deactivating ? 'accounts.deactivateBody' : 'accounts.reactivateBody',
                        values,
                    )}
                </p>
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </div>
        </Dialog>
    );
}
