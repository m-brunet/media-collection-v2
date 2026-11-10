import { useI18n } from '../i18n/i18n-context';
import { useAction } from '../use-action';
import { Button } from './button';
import { Dialog } from './dialog';
import { Notice } from './notice';

export function ConfirmDialog({
    open,
    title,
    body,
    confirm,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    body: string;
    confirm: string;
    onConfirm(): Promise<void>;
    onClose(): void;
}) {
    const { t } = useI18n();
    const action = useAction();

    return (
        <Dialog
            open={open}
            title={title}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="danger"
                        busy={action.busy}
                        onClick={() => void action.run(onConfirm)}
                    >
                        {confirm}
                    </Button>
                </>
            }
        >
            <p>{body}</p>
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
        </Dialog>
    );
}
