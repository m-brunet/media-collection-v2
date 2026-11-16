import { useEffect, useState } from 'react';
import type {
    KeptCoversDeletedDto,
    KeptCoverSummaryDto,
} from '../../../../../packages/contracts/src/http';
import { api } from '../../shared/api.util';
import { useI18n } from '../../shared/i18n/i18n-context';
import { StorageSize } from '../../shared/storage-size.util';
import { Button } from '../../shared/ui/button';
import { Dialog } from '../../shared/ui/dialog';
import { Panel } from '../../shared/ui/layout';
import { Notice } from '../../shared/ui/notice';
import { useAction } from '../../shared/use-action';

export function KeptCoversPanel({ onDeleted }: { onDeleted(count: number): void }) {
    const { t, locale, dates } = useI18n();
    const action = useAction();
    const [summary, setSummary] = useState<KeptCoverSummaryDto | null>(null);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        let current = true;

        api.request<KeptCoverSummaryDto>('/maintenance/kept-covers/summary').then(
            (loaded) => current && setSummary(loaded),
            () => undefined,
        );

        return () => {
            current = false;
        };
    }, []);

    if (!summary) {
        return null;
    }

    const values = { count: summary.count, size: StorageSize.format(summary.bytes, locale) };
    const close = () => {
        action.setFeedback(null);
        setConfirming(false);
    };
    const confirm = () =>
        void action.run(async () => {
            const { deleted } = await api.request<KeptCoversDeletedDto>(
                '/maintenance/kept-covers',
                { method: 'DELETE' },
            );

            setSummary({ count: 0, bytes: 0, oldestKeptAt: null });
            setConfirming(false);
            onDeleted(deleted);
        });

    return (
        <Panel label={t('keptCovers.label')}>
            {summary.count === 0 ? (
                <p className="muted">{t('keptCovers.none')}</p>
            ) : (
                <>
                    <p className="panel__title">
                        {t(summary.count === 1 ? 'keptCovers.one' : 'keptCovers.many', values)}
                    </p>
                    <p className="muted">
                        {t('keptCovers.intro')}
                        {summary.oldestKeptAt &&
                            ' ' +
                                t('keptCovers.oldest', { date: dates.date(summary.oldestKeptAt) })}
                    </p>
                    <div className="actions">
                        <Button variant="danger" onClick={() => setConfirming(true)}>
                            {t('keptCovers.delete')}
                        </Button>
                    </div>
                    <p className="field__hint">{t('keptCovers.hint')}</p>
                </>
            )}
            <Dialog
                open={confirming}
                title={t('keptCovers.confirmTitle')}
                onClose={close}
                footer={
                    <>
                        <Button onClick={close}>{t('common.cancel')}</Button>
                        <Button variant="danger" busy={action.busy} onClick={confirm}>
                            {t('keptCovers.delete')}
                        </Button>
                    </>
                }
            >
                <div className="form">
                    <p>
                        {t(
                            summary.count === 1
                                ? 'keptCovers.confirmOne'
                                : 'keptCovers.confirmMany',
                            values,
                        )}
                    </p>
                    {action.feedback && <Notice tone="error">{action.feedback.text}</Notice>}
                </div>
            </Dialog>
        </Panel>
    );
}
