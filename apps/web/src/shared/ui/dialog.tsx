import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n/i18n-context';
import { Icon } from './icon';

// Modal dialog built on the native <dialog>: the browser keeps focus inside it, Escape closes
// it, and focus returns to the element that opened it.
export function Dialog({
    open,
    title,
    onClose,
    children,
    footer,
}: {
    open: boolean;
    title: string;
    onClose(): void;
    children: ReactNode;
    footer?: ReactNode;
}) {
    const element = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const { t } = useI18n();

    useEffect(() => {
        const dialog = element.current;

        if (!dialog) {
            return;
        }

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={element}
            className="dialog"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="dialog__header">
                <h2 id={titleId} className="dialog__title">
                    {title}
                </h2>
                <button
                    type="button"
                    className="icon-button"
                    onClick={onClose}
                    aria-label={t('dialog.close')}
                >
                    <Icon name="close" size={18} />
                </button>
            </div>
            <div className="dialog__body">{children}</div>
            {footer && <div className="dialog__footer">{footer}</div>}
        </dialog>
    );
}
