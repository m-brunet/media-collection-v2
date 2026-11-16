import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { api, ApiError } from '../../shared/api.util';
import { ApiErrorMessage } from '../../shared/api-error-message.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { useI18n } from '../../shared/i18n/i18n-context';
import { Button } from '../../shared/ui/button';
import { Notice } from '../../shared/ui/notice';
import { SettingIds, SettingRow } from './setting-row';

const refusals: Record<string, MessageKey> = {
    'domain-unresolved': 'internet.domainRefused.unresolved',
    'domain-mismatch': 'internet.domainRefused.mismatch',
    'public-address-unknown': 'internet.domainRefused.addressUnknown',
};

export function DomainNameSection({
    domainName,
    httpsOn,
    onSaved,
}: {
    domainName: string | null;
    httpsOn: boolean;
    onSaved(): void;
}) {
    const { t } = useI18n();
    const id = useId();
    const [value, setValue] = useState(domainName ?? '');
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(
        null,
    );
    const entered = value.trim().toLowerCase().replace(/\.$/, '');
    const canSave = entered !== '' && entered !== domainName;
    const canRemove = domainName !== null && !httpsOn;
    const save = async (domain: string | null) => {
        setBusy(true);
        setFeedback(null);

        try {
            const saved = await api.request<{ domain: string | null }>(
                '/server-settings/domain-name',
                { method: 'PUT', body: { domain } },
            );

            setValue(saved.domain ?? '');
            setFeedback({
                tone: 'success',
                text: t(saved.domain ? 'internet.domainSaved' : 'internet.domainRemoved'),
            });
            onSaved();
        } catch (error) {
            const refusal =
                error instanceof ApiError && error.reason ? refusals[error.reason] : undefined;
            const address = error instanceof ApiError ? error.details?.publicAddress : undefined;

            setFeedback({
                tone: 'error',
                text: refusal
                    ? t(refusal, { address: typeof address === 'string' ? address : '' })
                    : t(ApiErrorMessage.key(error)),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <SettingRow
            id={id}
            title={t('internet.domain')}
            detail={domainName && httpsOn ? t('internet.domainLocked') : t('internet.domainHint')}
            control={
                <form
                    className="setting-row__form"
                    aria-label={t('internet.domain')}
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault();

                        if (canSave) {
                            void save(value.trim());
                        }
                    }}
                >
                    <input
                        id={id + '-field'}
                        name="domain"
                        className="field__control setting-row__field setting-row__field--wide"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="home.example.com"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={253}
                        aria-labelledby={SettingIds.title(id)}
                        aria-describedby={SettingIds.detail(id)}
                    />
                    <Button type="submit" busy={busy} disabled={!canSave}>
                        {t('internet.domainSave')}
                    </Button>
                    <Button busy={busy} disabled={!canRemove} onClick={() => void save(null)}>
                        {t('internet.domainRemove')}
                    </Button>
                </form>
            }
        >
            {feedback && <Notice tone={feedback.tone}>{feedback.text}</Notice>}
        </SettingRow>
    );
}
