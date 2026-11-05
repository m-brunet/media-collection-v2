import type { ReactNode } from 'react';
import { useState } from 'react';
import { useI18n } from '../i18n/i18n-context';
import { useAction } from '../use-action';
import { Button } from './button';
import { Dialog } from './dialog';
import { Notice } from './notice';
import { TextField } from './text-field';

// Asks for one name (create or rename), sends it, and keeps the dialog open with the reason when
// the server refuses it. `children` adds fields before the name (for example a parent choice).
export function NameDialog({
    open,
    title,
    body,
    label,
    placeholder,
    initial = '',
    submit,
    children,
    onSubmit,
    onClose,
}: {
    open: boolean;
    title: string;
    body?: string;
    label: string;
    placeholder?: string;
    initial?: string;
    submit: string;
    children?: ReactNode;
    onSubmit(name: string): Promise<void>;
    onClose(): void;
}) {
    return (
        <Dialog open={open} title={title} onClose={onClose}>
            {open && (
                <NameForm
                    body={body}
                    label={label}
                    placeholder={placeholder}
                    initial={initial}
                    submit={submit}
                    onSubmit={onSubmit}
                    onClose={onClose}
                >
                    {children}
                </NameForm>
            )}
        </Dialog>
    );
}

function NameForm({
    body,
    label,
    placeholder,
    initial,
    submit,
    children,
    onSubmit,
    onClose,
}: {
    body?: string;
    label: string;
    placeholder?: string;
    initial: string;
    submit: string;
    children?: ReactNode;
    onSubmit(name: string): Promise<void>;
    onClose(): void;
}) {
    const { t } = useI18n();
    const [name, setName] = useState(initial);
    const action = useAction();

    return (
        <form
            className="form"
            onSubmit={(event) => {
                event.preventDefault();
                void action.run(() => onSubmit(name));
            }}
        >
            {body && <p>{body}</p>}
            {children}
            <TextField
                label={label}
                value={name}
                required
                maxLength={100}
                autoFocus
                autoComplete="off"
                placeholder={placeholder}
                onChange={(event) => setName(event.target.value)}
            />
            {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
            <div className="actions">
                <Button type="submit" variant="primary" busy={action.busy}>
                    {submit}
                </Button>
                <Button variant="ghost" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
            </div>
        </form>
    );
}
