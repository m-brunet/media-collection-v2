import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import type { KeptCoversDto } from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Notice } from '../../shared/ui/notice';
import { TextField } from '../../shared/ui/text-field';
import { useAction } from '../../shared/use-action';

const formId = 'data-reset';

export function DataResetDialog({
    open,
    onClose,
    onReset,
}: {
    open: boolean;
    onClose(): void;
    onReset(): void;
}) {
    const { t } = useI18n();
    const action = useAction();
    const [password, setPassword] = useState('');
    const [understood, setUnderstood] = useState(false);
    const [keptCovers, setKeptCovers] = useState(0);
    const [deleteKeptCovers, setDeleteKeptCovers] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        let current = true;

        api.request<KeptCoversDto>('/maintenance/kept-covers').then(
            (kept) => current && setKeptCovers(kept.count),
            () => current && setKeptCovers(0),
        );

        return () => {
            current = false;
        };
    }, [open]);

    const close = () => {
        action.setFeedback(null);
        setPassword('');
        setUnderstood(false);
        setDeleteKeptCovers(false);
        onClose();
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void action.run(async () => {
            await api.request('/maintenance/data-reset', {
                method: 'POST',
                body: { password, deleteKeptCovers },
            });
            onReset();
        });
    };

    return (
        <Dialog
            open={open}
            title={t('dataReset.title')}
            onClose={close}
            footer={
                <>
                    <Button onClick={close}>{t('common.cancel')}</Button>
                    <Button
                        type="submit"
                        form={formId}
                        variant="danger"
                        busy={action.busy}
                        disabled={password.length === 0 || !understood}
                    >
                        {t('dataReset.submit')}
                    </Button>
                </>
            }
        >
            <form id={formId} className="form" onSubmit={submit}>
                <p>{t('dataReset.body')}</p>
                <p>{t('dataReset.covers')}</p>
                {keptCovers > 0 && (
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={deleteKeptCovers}
                            onChange={(event) => setDeleteKeptCovers(event.target.checked)}
                        />
                        {t(
                            keptCovers === 1
                                ? 'dataReset.deleteCoversOne'
                                : 'dataReset.deleteCoversMany',
                            { count: keptCovers },
                        )}
                    </label>
                )}
                <TextField
                    label={t('dataReset.password')}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('dataReset.passwordPlaceholder')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    maxLength={128}
                    required
                />
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={understood}
                        onChange={(event) => setUnderstood(event.target.checked)}
                    />
                    {t('dataReset.understood')}
                </label>
                {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            </form>
        </Dialog>
    );
}
