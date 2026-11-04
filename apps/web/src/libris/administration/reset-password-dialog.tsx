import type { FormEvent } from 'react';
import type { AccountSummary } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

const formId = 'reset-password';

export function ResetPasswordDialog({
    account,
    onClose,
    onReset,
}: {
    account: AccountSummary | null;
    onClose(): void;
    onReset(account: AccountSummary): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const username = account?.username ?? '';
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const password = new FormData(element).get('password');

        if (!account) {
            return;
        }

        void action.run(async () => {
            const updated = await api.request<AccountSummary>(
                '/users/' + account.id + '/password-reset',
                { method: 'POST', body: { password } },
            );

            element.reset();
            onReset(updated);
        });
    };

    return (
        <Dialog
            open={account !== null}
            title={t('accounts.resetTitle', { username })}
            onClose={() => {
                action.setFeedback(null);
                onClose();
            }}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="submit" form={formId} variant="primary" busy={action.busy}>
                        {t('accounts.resetPassword')}
                    </Button>
                </>
            }
        >
            <form id={formId} className="form" onSubmit={submit}>
                <p className="muted">{t('accounts.resetIntro', { username })}</p>
                <TextField
                    label={t('accounts.temporaryPassword')}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    hint={t('password.rules')}
                    minLength={8}
                    maxLength={128}
                    required
                />
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </form>
        </Dialog>
    );
}
