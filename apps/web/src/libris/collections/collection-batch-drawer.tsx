import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Icon } from '../../shared/ui/icon';

export type DrawerStep = 'change' | 'review';

const steps: { step: 'choose' | DrawerStep; label: MessageKey }[] = [
    { step: 'choose', label: 'batch.step.choose' },
    { step: 'change', label: 'batch.step.change' },
    { step: 'review', label: 'batch.step.review' },
];

export function CollectionBatchDrawer({
    step,
    title,
    onClose,
    children,
    footer,
}: {
    step: DrawerStep;
    title: string;
    onClose(): void;
    children: ReactNode;
    footer: ReactNode;
}) {
    const { t } = useI18n();
    const titleId = useId();
    const heading = useRef<HTMLHeadingElement>(null);
    const close = useRef(onClose);

    useEffect(() => {
        close.current = onClose;
    });

    useEffect(() => {
        heading.current?.focus({ preventScroll: true });
    }, [step]);

    useEffect(() => {
        const escape = (event: KeyboardEvent) => {
            if (
                event.key === 'Escape' &&
                !event.defaultPrevented &&
                !document.querySelector('dialog[open]')
            ) {
                close.current();
            }
        };

        document.addEventListener('keydown', escape);

        return () => document.removeEventListener('keydown', escape);
    }, []);

    return (
        <section
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className="batch-drawer"
        >
            <ol className="batch-steps" aria-label={t('batch.steps')}>
                {steps.map((item, index) => (
                    <li
                        key={item.step}
                        className={
                            'batch-steps__step' +
                            (item.step === step ? ' batch-steps__step--current' : '')
                        }
                        aria-current={item.step === step ? 'step' : undefined}
                    >
                        <span aria-hidden="true">{index + 1}</span> {t(item.label)}
                    </li>
                ))}
            </ol>
            <div className="batch-drawer__header">
                <h2 ref={heading} id={titleId} tabIndex={-1} className="batch-drawer__title">
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
            <div className="batch-drawer__body">{children}</div>
            <div className="batch-drawer__footer">{footer}</div>
        </section>
    );
}
