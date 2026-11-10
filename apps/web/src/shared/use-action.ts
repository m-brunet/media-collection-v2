import { useCallback, useState } from 'react';
import { ApiErrorMessage } from './api-error-message.util';
import type { MessageKey } from './i18n/catalog-en';
import { useI18n } from './i18n/i18n-context';

export interface Feedback {
    tone: 'success' | 'error';
    text: string;
}

export function useAction() {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const run = useCallback(
        async (
            action: () => Promise<void>,
            success?: MessageKey,
            errors: Partial<Record<number | string, MessageKey>> = {},
        ) => {
            setBusy(true);
            setFeedback(null);

            try {
                await action();
                setFeedback(success ? { tone: 'success', text: t(success) } : null);
            } catch (error) {
                setFeedback({ tone: 'error', text: t(ApiErrorMessage.key(error, errors)) });
            } finally {
                setBusy(false);
            }
        },
        [t],
    );
    const fail = useCallback(
        (key: MessageKey) => setFeedback({ tone: 'error', text: t(key) }),
        [t],
    );

    return { busy, feedback, run, fail, setFeedback };
}
