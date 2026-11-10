import type { FormEvent } from 'react';
import type { AccountSummary } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { SelectField } from '../../shared/ui/select-field';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

const formId = 'create-account';

export function CreateAccountDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose(): void;
    onCreated(account: AccountSummary): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);

        void action.run(async () => {
            const account = await api.request<AccountSummary>('/users', {
                method: 'POST',
                body: {
                    username: form.get('username'),
                    password: form.get('password'),
                    role: form.get('role'),
                },
            });

            element.reset();
            onCreated(account);
        });
    };

    return (
        <Dialog
            open={open}
            title={t('accounts.createTitle')}
            onClose={() => {
                action.setFeedback(null);
                onClose();
            }}
            footer={
                <>
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="submit" form={formId} variant="primary" busy={action.busy}>
                        {t('accounts.create')}
                    </Button>
                </>
            }
        >
            <form id={formId} className="form" onSubmit={submit}>
                <p className="muted">{t('accounts.createIntro')}</p>
                <TextField
                    label={t('accounts.username')}
                    name="username"
                    autoComplete="off"
                    hint={t('account.usernameRules')}
                    minLength={3}
                    maxLength={40}
                    required
                />
                <SelectField
                    label={t('accounts.role')}
                    name="role"
                    defaultValue=""
                    placeholder={t('accounts.rolePlaceholder')}
                    options={[
                        { value: 'owner', label: t('role.owner') },
                        { value: 'guest', label: t('role.guest') },
                    ]}
                    required
                />
                <TextField
                    label={t('accounts.temporaryPassword')}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    hint={t('accounts.temporaryHint')}
                    minLength={8}
                    maxLength={128}
                    required
                />
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </form>
        </Dialog>
    );
}
